// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MemeToken} from "./MemeToken.sol";

/// @title MemeLaunch
/// @notice Permissionless fixed-supply meme-token launch using a virtual-USDC
///         constant-product bonding curve. No initial LP or market maker is needed.
/// @dev USDC amounts use the Arc USDC ERC-20 precision (6 decimals). Token amounts
///      use 18 decimals. Pricing uses internal reserves so accidental direct token
///      transfers do not manipulate the curve.
contract MemeLaunch is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant TOKEN_UNIT = 1e18;
    uint256 private constant USDC_TO_E18 = 1e12;
    uint256 public constant BPS = 10_000;
    uint256 public constant CREATOR_FEE_BPS = 30;
    uint256 public constant PROTOCOL_FEE_BPS = 95;
    uint256 public constant TOTAL_FEE_BPS = CREATOR_FEE_BPS + PROTOCOL_FEE_BPS;

    IERC20 public immutable usdc;
    MemeToken public immutable token;
    address public immutable creator;
    address public immutable protocolTreasury;
    uint256 public immutable totalSupply;
    uint256 public immutable virtualUsdcReserve;
    string public metadataURI;

    // Internal accounting. Direct transfers to this contract are intentionally
    // excluded from price calculations.
    uint256 public tokenReserve;
    uint256 public realUsdcReserve;
    uint256 public creatorFeesAccrued;
    uint256 public protocolFeesAccrued;

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineExpired();
    error SlippageExceeded();
    error InsufficientRealReserve();
    error ReserveInvariant();
    error Unauthorized();
    error NoFeesAccrued();

    event Bought(
        address indexed buyer,
        address indexed recipient,
        uint256 grossUsdcIn,
        uint256 netUsdcIn,
        uint256 tokenOut,
        uint256 creatorFee,
        uint256 protocolFee,
        uint256 tokenReserveAfter,
        uint256 realUsdcReserveAfter
    );

    event Sold(
        address indexed seller,
        address indexed recipient,
        uint256 tokenIn,
        uint256 grossUsdcOut,
        uint256 netUsdcOut,
        uint256 creatorFee,
        uint256 protocolFee,
        uint256 tokenReserveAfter,
        uint256 realUsdcReserveAfter
    );

    event FeesAccrued(uint256 creatorFee, uint256 protocolFee);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ProtocolFeesClaimed(address indexed treasury, uint256 amount);

    constructor(
        address usdc_,
        address creator_,
        address protocolTreasury_,
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 virtualUsdcReserve_,
        string memory metadataURI_
    ) {
        if (usdc_ == address(0) || creator_ == address(0) || protocolTreasury_ == address(0)) revert ZeroAddress();
        if (totalSupply_ == 0 || virtualUsdcReserve_ == 0) revert ZeroAmount();

        usdc = IERC20(usdc_);
        creator = creator_;
        protocolTreasury = protocolTreasury_;
        totalSupply = totalSupply_;
        virtualUsdcReserve = virtualUsdcReserve_;
        metadataURI = metadataURI_;

        MemeToken deployedToken = new MemeToken(
            name_,
            symbol_,
            totalSupply_,
            address(this)
        );
        token = deployedToken;
        tokenReserve = totalSupply_;
    }

    /// @notice Virtual + real USDC used by the curve.
    function curveUsdcReserve() public view returns (uint256) {
        return virtualUsdcReserve + realUsdcReserve;
    }

    /// @notice Quote a buy from its gross USDC input, including the trading fee.
    function getBuyQuote(uint256 grossUsdcIn)
        public
        view
        returns (uint256 tokenOut, uint256 netUsdcIn, uint256 creatorFee, uint256 protocolFee)
    {
        if (grossUsdcIn == 0 || tokenReserve == 0) return (0, 0, 0, 0);
        (creatorFee, protocolFee) = _fees(grossUsdcIn);
        netUsdcIn = grossUsdcIn - creatorFee - protocolFee;
        if (netUsdcIn == 0) return (0, netUsdcIn, creatorFee, protocolFee);
        tokenOut = _quoteBuyNet(netUsdcIn);
    }

    /// @notice Quote tokens received for an exact gross USDC input.
    /// @dev x*y=k curve with a virtual USDC reserve:
    ///      tokenOut = x * usdcIn / (y + usdcIn)
    function quoteBuy(uint256 usdcIn) public view returns (uint256 tokenOut) {
        (tokenOut,,,) = getBuyQuote(usdcIn);
    }

    /// @notice Quote a sell including gross curve output and fee breakdown.
    function getSellQuote(uint256 tokenIn)
        public
        view
        returns (uint256 netUsdcOut, uint256 grossUsdcOut, uint256 creatorFee, uint256 protocolFee)
    {
        grossUsdcOut = _quoteSellGross(tokenIn);
        if (grossUsdcOut == 0) return (0, 0, 0, 0);
        (creatorFee, protocolFee) = _fees(grossUsdcOut);
        netUsdcOut = grossUsdcOut - creatorFee - protocolFee;
    }

    /// @notice Quote net USDC received for an exact token input.
    /// @dev usdcOut = y * tokenIn / (x + tokenIn). Only the real reserve can
    ///      actually be paid; the virtual reserve is pricing liquidity, not funds.
    function quoteSell(uint256 tokenIn) public view returns (uint256 usdcOut) {
        (usdcOut,,,) = getSellQuote(tokenIn);
    }

    /// @notice Current marginal price of one full token, denominated in USDC,
    ///         returned with 18 decimals for UI precision.
    function spotPriceE18() public view returns (uint256) {
        if (tokenReserve == 0) return type(uint256).max;

        // curveUsdcReserve is 6 decimals. Convert it to 18 decimals, then divide
        // by tokenReserve/1e18. Algebraically: y * 1e30 / x.
        return Math.mulDiv(
            curveUsdcReserve(),
            USDC_TO_E18 * TOKEN_UNIT,
            tokenReserve
        );
    }

    /// @notice Implied fully diluted market cap in USDC with 18 decimals.
    function marketCapE18() public view returns (uint256) {
        return Math.mulDiv(spotPriceE18(), totalSupply, TOKEN_UNIT);
    }

    function circulatingSupply() public view returns (uint256) {
        return totalSupply - tokenReserve;
    }

    function progressBps() public view returns (uint256) {
        return Math.mulDiv(circulatingSupply(), BPS, totalSupply);
    }

    /// @notice Compact read method for frontends.
    function marketState()
        external
        view
        returns (
            uint256 tokenReserve_,
            uint256 realUsdcReserve_,
            uint256 curveUsdcReserve_,
            uint256 circulatingSupply_,
            uint256 spotPriceE18_,
            uint256 marketCapE18_,
            uint256 progressBps_
        )
    {
        tokenReserve_ = tokenReserve;
        realUsdcReserve_ = realUsdcReserve;
        curveUsdcReserve_ = curveUsdcReserve();
        circulatingSupply_ = circulatingSupply();
        spotPriceE18_ = spotPriceE18();
        marketCapE18_ = marketCapE18();
        progressBps_ = progressBps();
    }

    function buy(
        uint256 usdcIn,
        uint256 minTokenOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenOut) {
        if (recipient == address(0)) revert ZeroAddress();
        if (usdcIn == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert DeadlineExpired();

        uint256 netUsdcIn;
        uint256 creatorFee;
        uint256 protocolFee;
        (tokenOut, netUsdcIn, creatorFee, protocolFee) = getBuyQuote(usdcIn);
        if (tokenOut == 0 || tokenOut < minTokenOut) revert SlippageExceeded();
        if (tokenOut >= tokenReserve) revert ReserveInvariant();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        tokenReserve -= tokenOut;
        realUsdcReserve += netUsdcIn;
        creatorFeesAccrued += creatorFee;
        protocolFeesAccrued += protocolFee;

        IERC20(address(token)).safeTransfer(recipient, tokenOut);

        emit Bought(
            msg.sender,
            recipient,
            usdcIn,
            netUsdcIn,
            tokenOut,
            creatorFee,
            protocolFee,
            tokenReserve,
            realUsdcReserve
        );
        emit FeesAccrued(creatorFee, protocolFee);
    }

    function sell(
        uint256 tokenIn,
        uint256 minUsdcOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 usdcOut) {
        if (recipient == address(0)) revert ZeroAddress();
        if (tokenIn == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert DeadlineExpired();

        uint256 grossUsdcOut;
        uint256 creatorFee;
        uint256 protocolFee;
        (usdcOut, grossUsdcOut, creatorFee, protocolFee) = getSellQuote(tokenIn);
        if (usdcOut == 0 || usdcOut < minUsdcOut) revert SlippageExceeded();
        if (grossUsdcOut > realUsdcReserve) revert InsufficientRealReserve();
        if (tokenReserve + tokenIn > totalSupply) revert ReserveInvariant();

        IERC20(address(token)).safeTransferFrom(
            msg.sender,
            address(this),
            tokenIn
        );

        tokenReserve += tokenIn;
        realUsdcReserve -= grossUsdcOut;
        creatorFeesAccrued += creatorFee;
        protocolFeesAccrued += protocolFee;

        usdc.safeTransfer(recipient, usdcOut);

        emit Sold(
            msg.sender,
            recipient,
            tokenIn,
            grossUsdcOut,
            usdcOut,
            creatorFee,
            protocolFee,
            tokenReserve,
            realUsdcReserve
        );
        emit FeesAccrued(creatorFee, protocolFee);
    }

    function claimCreatorFees() external nonReentrant returns (uint256 amount) {
        if (msg.sender != creator) revert Unauthorized();
        amount = creatorFeesAccrued;
        if (amount == 0) revert NoFeesAccrued();
        creatorFeesAccrued = 0;
        usdc.safeTransfer(creator, amount);
        emit CreatorFeesClaimed(creator, amount);
    }

    function claimProtocolFees() external nonReentrant returns (uint256 amount) {
        if (msg.sender != protocolTreasury) revert Unauthorized();
        amount = protocolFeesAccrued;
        if (amount == 0) revert NoFeesAccrued();
        protocolFeesAccrued = 0;
        usdc.safeTransfer(protocolTreasury, amount);
        emit ProtocolFeesClaimed(protocolTreasury, amount);
    }

    function _quoteBuyNet(uint256 netUsdcIn) private view returns (uint256) {
        return Math.mulDiv(tokenReserve, netUsdcIn, curveUsdcReserve() + netUsdcIn);
    }

    function _quoteSellGross(uint256 tokenIn) private view returns (uint256) {
        if (tokenIn == 0) return 0;
        return Math.mulDiv(curveUsdcReserve(), tokenIn, tokenReserve + tokenIn);
    }

    function _fees(uint256 grossAmount) private pure returns (uint256 creatorFee, uint256 protocolFee) {
        creatorFee = Math.mulDiv(grossAmount, CREATOR_FEE_BPS, BPS);
        protocolFee = Math.mulDiv(grossAmount, PROTOCOL_FEE_BPS, BPS);
    }
}
