// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeLaunch} from "./MemeLaunch.sol";

/// @title MemeFactory
/// @notice Permissionless factory for fixed-supply Arc meme launches.
/// @dev The factory has no owner and no privileged functions.
contract MemeFactory {
    uint256 public constant MIN_SUPPLY = 1_000_000 ether;
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 ether;

    address public immutable usdc;
    uint256 public immutable virtualUsdcReserve;
    address public immutable protocolTreasury;

    address[] public launches;
    mapping(address => bool) public isLaunch;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidName();
    error InvalidSymbol();
    error MetadataTooLong();
    error SupplyOutOfRange();

    event LaunchCreated(
        uint256 indexed index,
        address indexed creator,
        address indexed launch,
        address token,
        string name,
        string symbol,
        uint256 totalSupply,
        string metadataURI
    );

    constructor(address usdc_, uint256 virtualUsdcReserve_, address protocolTreasury_) {
        if (usdc_ == address(0) || protocolTreasury_ == address(0)) revert ZeroAddress();
        if (virtualUsdcReserve_ == 0) revert ZeroAmount();

        usdc = usdc_;
        virtualUsdcReserve = virtualUsdcReserve_;
        protocolTreasury = protocolTreasury_;
    }

    function launchCount() external view returns (uint256) {
        return launches.length;
    }

    function createLaunch(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        string calldata metadataURI_
    ) external returns (address launchAddress, address tokenAddress) {
        uint256 nameLength = bytes(name_).length;
        uint256 symbolLength = bytes(symbol_).length;

        if (nameLength == 0 || nameLength > 32) revert InvalidName();
        if (symbolLength == 0 || symbolLength > 12) revert InvalidSymbol();
        if (bytes(metadataURI_).length > 256) revert MetadataTooLong();
        if (totalSupply_ < MIN_SUPPLY || totalSupply_ > MAX_SUPPLY) {
            revert SupplyOutOfRange();
        }

        MemeLaunch launch = new MemeLaunch(
            usdc,
            msg.sender,
            protocolTreasury,
            name_,
            symbol_,
            totalSupply_,
            virtualUsdcReserve,
            metadataURI_
        );

        launchAddress = address(launch);
        tokenAddress = address(launch.token());

        uint256 index = launches.length;
        launches.push(launchAddress);
        isLaunch[launchAddress] = true;

        emit LaunchCreated(
            index,
            msg.sender,
            launchAddress,
            tokenAddress,
            name_,
            symbol_,
            totalSupply_,
            metadataURI_
        );
    }
}
