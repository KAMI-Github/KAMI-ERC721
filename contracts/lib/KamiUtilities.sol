// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library KamiUtilities {

    // Declare the RoyaltyDistributed event
    event RoyaltyDistributed(address indexed receiver, uint256 amount);

    // Calculate the royalty for a given amount based on the shares
    /**
     * @dev Calculates the royalty for a given amount based on the shares.
     * @param amount The amount to calculate the royalty for.
     * @param shares The shares to calculate the royalty for.
     * @return The royalty for the given amount.
     */
    function calculateRoyalty(uint256 amount, uint256[] memory shares) internal pure returns (uint256[] memory, uint256) {
        uint256[] memory distributedShares = new uint256[](shares.length);
        uint256 totalDistributed = 0;   
        for (uint256 i = 0; i < shares.length; i++) {
            uint256 share = shares[i];
            uint256 distributedAmount = (amount * share) / 10000;
            distributedShares[i] = distributedAmount;
            totalDistributed += distributedAmount;
        }
        return (distributedShares, totalDistributed);
    }

    // Distribute the royalty to the receivers
    /**
     * @dev Distributes the royalty to the receivers.
     * @param from The address to distribute the royalty from.
     * @param amount The amount to distribute.
     * @param shares The shares to distribute.
     * @param receivers The addresses to distribute the royalty to.
     * @param secondaryPercentage The secondary royalty percentage.
     * @param paymentToken The payment token to use for the distribution.
     * @return The distributed shares and the total distributed amount.
     */
        function distributeRoyalty(
            address from,
            uint256 amount,
            uint256[] memory shares,
            address[] memory receivers,
            uint256 secondaryPercentage,
            IERC20 paymentToken
        ) internal returns (uint256[] memory, uint256) {
        (uint256[] memory distributedAmounts, uint256 totalDistributed) = calculateRoyalty(
            secondaryPercentage > 0 ? amount * secondaryPercentage / 10000 : amount,
            shares
        );
                
        for (uint256 i = 0; i < receivers.length; i++) {
            paymentToken.transferFrom(from, receivers[i], distributedAmounts[i]);
            totalDistributed += distributedAmounts[i];
            emit RoyaltyDistributed(receivers[i], distributedAmounts[i]);
        }
        return (distributedAmounts, totalDistributed);
    }

    // Helper function to check if an address is in an array
    /**
     * @dev Checks if a given address is present in an array of addresses.
     * @param array The array of addresses to search through.
     * @param addr The address to check for in the array.
     * @return True if the address is found in the array, false otherwise.
     */
    function _isAddressInArray(address[] memory array, address addr) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == addr) {
                return true;
            }
        }
        return false;
    }

}
