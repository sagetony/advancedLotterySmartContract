const { ethers, network } = require("hardhat")
const fs = require("fs")
const FRONTEND_ADDRESS_LOCATION = "../LotteryFrontend/constants/contractAddress.json"
const FRONTEND_ABI_LOCATION = "../LotteryFrontend/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_UI) {
        console.log("update the UI")
        contractAddress()
        abiUpdate()
    }
}
async function abiUpdate() {
    const lottery = await ethers.getContract("Lottery")
    fs.writeFileSync(FRONTEND_ABI_LOCATION, lottery.interface.format(ethers.utils.FormatTypes.json))
}
async function contractAddress() {
    const lotteryAddress = await ethers.getContract("Lottery")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESS_LOCATION, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(lotteryAddress.address)) {
            currentAddresses[chainId].push(lotteryAddress.address)
        }
    } else {
        currentAddresses[chainId] = [lotteryAddress.address]
    }
    fs.writeFileSync(FRONTEND_ADDRESS_LOCATION, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]
