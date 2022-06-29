const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-config")
const { verify } = require("../utils/verify")
const FUND_AMOUNT = ethers.utils.parseEther("30")
module.exports = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy, get, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinator
    let subscriptionId
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorAddress = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinator = vrfCoordinatorAddress.address
        const createSub = await vrfCoordinatorAddress.createSubscription()
        const transactionReceipt = await createSub.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        // fund the subscription to work
        await vrfCoordinatorAddress.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinator = networkConfig[chainId]["vrfCoordinator"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const ethAmount = networkConfig[chainId]["ethAmount"]
    const keyHash = networkConfig[chainId]["keyHash"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [vrfCoordinator, ethAmount, keyHash, subscriptionId, callbackGasLimit, interval]
    const Lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmation: network.config.blockConfirmation || 1,
    })
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(Lottery.address, args)
    }
    log("-----------------------------")
}

module.exports.tags = ["all", "Lottery"]
