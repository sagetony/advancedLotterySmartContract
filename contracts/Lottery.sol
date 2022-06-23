//  get funds from players
// register the players
// randomly select the winner after a specfic time
// reset the lottery

// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;
error Lottery__EthIsNotEnough();
error Lottery__TransferFailed();
error Lottery__RaffleStateOpen();
error RaffleState__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
@title Lottery Application
@author Uchechukwu Anthony
@dev Chainlink VRF V2 and Chainlink Keepers
 */

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_ethAmount;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_VRFCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant requestConfirmations = 3;
    uint32 private constant numWords = 1;
    address payable s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    event lotteryFund(address indexed player);
    event requestedRandomWinner(uint256 requestId);
    event winnerAddress(address randomWinner);

    constructor(
        address vrfCoordinator,
        uint256 ethAmount,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_ethAmount = ethAmount;
        i_VRFCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function fundLottery() public payable {
        if (msg.value < i_ethAmount) {
            revert Lottery__EthIsNotEnough();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Lottery__RaffleStateOpen();
        }
        s_players.push(payable(msg.sender));

        // emit functionality
        emit lotteryFund(msg.sender);
    }

    /**
     * @dev This is a function that the Chainlink Keeper nodes call
     * they look for the UpkeepNeeded to return true
     * The following should be true in order to return true
     * 1. Our time interval should have passed
     * 2. lottery should have aleast one player and Eth
     * 3. Our subscription should be funded with LINK
     * 4. The lottery should be in an open state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool hasPlayers = s_players.length > 0;
        bool hasAmount = address(this).balance > 0;
        bool checkTime = ((block.timestamp - s_lastTimeStamp) > i_interval);
        upkeepNeeded = (isOpen && hasPlayers && hasAmount && checkTime);
        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert RaffleState__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        uint256 requestId = i_VRFCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            requestConfirmations,
            i_callbackGasLimit,
            numWords
        );
        s_raffleState = RaffleState.CALCULATING;
        emit requestedRandomWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfRandomNum = randomWords[0] % s_players.length;
        address payable randomWinner = s_players[indexOfRandomNum];
        s_recentWinner = randomWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
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

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getnumWords() public pure returns (uint256) {
        return numWords;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }
}
