const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", function () {
          let Lottery, VRFCoordinatorV2Mock, deployer, lotteryEthAmount, lotteryInterval
          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture("all")
              Lottery = await ethers.getContract("Lottery", deployer)
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
          })
          describe("Constructor", function () {
              it("Initializing the contract with valuable info", async function () {
                  const lotteryState = await Lottery.getRaffleState()
                  lotteryInterval = await Lottery.getInterval()
                  lotteryEthAmount = await Lottery.getEthAmount()
                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(lotteryInterval.toString(), networkConfig[chainId]["interval"])
                  assert.equal(lotteryEthAmount.toString(), "10000000000000000")
              })
          })

          describe("fundLottery", function () {
              it("fund the lottery", async function () {
                  await expect(Lottery.fundLottery()).to.be.revertedWith("Lottery__EthIsNotEnough")
              })
              it("get player", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  const lotteryPlayer = await Lottery.getPlayer(0)
                  assert.equal(lotteryPlayer, deployer)
              })
              it("Emit Event", async function () {
                  await expect(Lottery.fundLottery({ value: lotteryEthAmount })).to.emit(
                      Lottery,
                      "lotteryFund"
                  )
              })

              it("check if he lottery is open or calculating", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await Lottery.performUpkeep([])
                  await expect(Lottery.fundLottery({ value: lotteryEthAmount })).to.be.revertedWith(
                      "Lottery__RaffleStateOpen"
                  )
              })
          })
          describe("checkUpKeep", function () {
              it("return false if there is no ETH", async function () {
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("return false if the raffle is not opening", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await Lottery.performUpkeep([])
                  const checkState = await Lottery.getRaffleState()
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert.equal(checkState.toString(), "1")
                  assert(!upkeepNeeded)
              })
              it("return false if the time has not reached", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() - 10])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("return true if there is ETH, players, contract is OPEN, time has reached", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
          })
      })
