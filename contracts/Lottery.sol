//  get funds from players
// register the players
// randomly select the winner after a specfic time
// reset the lottery

// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;
error Lottery__EthIsNotEnough();
error Lottery__TransferFailed();

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

contract Lottery is VRFConsumerBaseV2 {
    uint256 private immutable i_ethAmount;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_VRFCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant requestConfirmations = 3;
    uint32 private constant numWords = 1;
    address payable s_recentWinner;

    event lotteryFund(address indexed player);
    event requestedRandomWinner(uint256 requestId);
    event winnerAddress(address randomWinner);

    constructor(
        address vrfCoordinator,
        uint256 ethAmount,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_ethAmount = ethAmount;
        i_VRFCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
    }

    function fundLottery() public payable {
        if (msg.value < i_ethAmount) {
            revert Lottery__EthIsNotEnough();
        }
        s_players.push(payable(msg.sender));

        // emit functionality
        emit lotteryFund(msg.sender);
    }

    function requestRandomWinner() external {
        uint256 requestId = i_VRFCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            requestConfirmations,
            i_callbackGasLimit,
            numWords
        );
        emit requestedRandomWinner(requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 indexOfRandomNum = randomWords[0] % s_players.length;
        address payable randomWinner = s_players[indexOfRandomNum];
        s_recentWinner = randomWinner;
        (bool success, ) = randomWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit winnerAddress(randomWinner);
    }

    /** pure view functions */
    function getEthAmount() public view returns (uint256) {
        return i_ethAmount;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }
}
