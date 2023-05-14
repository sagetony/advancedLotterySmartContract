const { ethers, network } = require("hardhat")
const { networks } = require("../hardhat.config")

async function mockKeepers() {
    const raffle = await ethers.getContract("Lottery")
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))

    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData)
    console.log(upkeepNeeded)
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        console.log(network.config.chainId)

        await mockVrf(requestId, raffle)
        console.log(network.config.chainId)
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
    console.log("Responded!")
    const recentWinner = await raffle.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
