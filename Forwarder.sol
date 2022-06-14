//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @author 0xCaleb
 * @dev Forwarder contract to facilitate metatransactions on Ethereum L1. Intended to be used for Vennity NFT
 * so that they can pay gas fees on their frontend application. Allows for generic calls to any contract without
 * any incentive for the caller to pay the user's gas fees. For Vennity's case, we have a web2-native fiat subscription plan.
 * References: https://github.com/austintgriffith/bouncer-proxy/blob/master/BouncerProxy/BouncerProxy.sol
 *             https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/metatx/MinimalForwarder.sol
 */

contract Forwarder is Ownable {

    bool paused; // pauses executeCall

    struct Invoice {
        address user;           // address of user
        address collection;     // address of collection (VennityCollection)
        uint256 value;          // payable value - will be zero since user does not pay
        uint256 nonce;          // nonce of user to avoid replay
        bytes data;             // data of function signature to call obtained by 
                                //   `abi.encodeWithSignature(_mint(address,string,string,uint256,string), comma-separated inputs..)` 
                                //   for example. Would work for any function signature (mint, burn, transfer, etc.) and returns bytes
    }

    mapping(address => uint256) private _nonces; // keeps track of user's nonces
    mapping(address => bool) private whitelist; // keeps track if user is whitelisted

    event whitelisted(address account);
    event removed(address account);
    event executedCall(Invoice request);

    constructor() {
        whitelist[msg.sender] = true;
        paused = false;
    }

    ///////////////////////////////////////
    // |        VIEW FUNCTIONS         | //
    ///////////////////////////////////////

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function isWhitelist(address account) public view returns (bool) {
        return whitelist[account];
    }

    ///////////////////////////////////////
    // |          ONLY OWNER           | //
    ///////////////////////////////////////
    
    /**
     * @dev adds user to the whitelist by first verifying that she signed the message letting us whitelist them
     */
    function addWhitelist(address account) external onlyOwner {
        require(!whitelist[account], "user is already whitelisted");
        whitelist[account] = true;
        emit whitelisted(account);
    }

    /**
     * @dev removes user from whitelist
     */
    function removeWhitelist(address account) external onlyOwner {
        require(whitelist[account], "user is not whitelisted");
        whitelist[account] = false;
        emit removed(account);
    }

    /**
     * @dev pauses executeCall function
     */
    function pause() external onlyOwner {
        require(!paused, "Contract is already paused");
        paused = true;
    }

    /**
     * @dev unpauses executeCall function
     */
    function unpause() external onlyOwner {
        require(paused, "Contract is already not paused");
        paused = false;
    }

    ///////////////////////////////////////
    // |        CALL A FUNCTION        | //
    ///////////////////////////////////////

    function executeCall(Invoice calldata req)
        public
        payable
        returns (bool, bytes memory)
    {
        require(!paused, "Contract is paused");
        require(whitelist[req.user], "User is not whitelisted");
        _nonces[req.user] = req.nonce + 1;
        uint gas = gasleft(); // gas is amount paid to execute call
        (bool success, bytes memory returndata) = req.collection.call{gas: gas, value: 0}(req.data);
        require(success, "Call failed to execute");
        emit executedCall(req);
        // Validate that the relayer has sent enough gas for the call.
        // See https://ronan.eth.link/blog/ethereum-gas-dangers/
        assert(gasleft() > gas / 63);

        return (success, returndata);
    }


}
