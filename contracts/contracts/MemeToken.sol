// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MemeToken
/// @notice Fixed-supply ERC-20 created by a MemeLaunch. There is deliberately
///         no owner, mint function, tax, blacklist, pause, or upgrade hook.
contract MemeToken is ERC20 {
    uint256 public immutable INITIAL_SUPPLY;

    error ZeroHolder();
    error ZeroSupply();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address initialHolder_
    ) ERC20(name_, symbol_) {
        if (initialHolder_ == address(0)) revert ZeroHolder();
        if (supply_ == 0) revert ZeroSupply();

        INITIAL_SUPPLY = supply_;
        _mint(initialHolder_, supply_);
    }
}
