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
          describe("performUpkeep", function () {
              it("check if the upkeepNeeded is true", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
              it("reverts when upkeepNeeded is false", async function () {
                  await expect(Lottery.performUpkeep([])).to.be.revertedWith(
                      "RaffleState__UpkeepNotNeeded"
                  )
              })
              it("check if the state changes, emit event and check the vrf coordinator", async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await Lottery.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  const checkState = await Lottery.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert.equal(checkState.toString(), "1")
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await Lottery.fundLottery({ value: lotteryEthAmount })
                  await network.provider.send("evm_increaseTime", [lotteryInterval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("it can only be called after a performUpkeep", async function () {
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("pick a winner, reset the lottery, and send the money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 // deployer has index 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = Lottery.connect(accounts[i])
                      await accountConnectedRaffle.fundLottery({ value: lotteryEthAmount })
                  }
                  const startingTimeStamp = await Lottery.getLastTimeStamp()
                  await new Promise(async (resolve, reject) => {
                      Lottery.once("winnerAddress", async function () {
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await Lottery.getRecentWinner()
                              const raffleState = await Lottery.getRaffleState()
                              const winnerBalance = await accounts[1].getBalance()
                              const NumberOfPlayers = await Lottery.getNumberOfPlayers()
                              const endingTimeStamp = await Lottery.getLastTimeStamp()
                              //   await expect(Lottery.getPlayer(0)).to.be.reverted
                              //   const num = "40000000000000000"
                              assert.equal(NumberOfPlayers.toString(), "0")
                              assert.equal(raffleState, 0)
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerBalance.toString(),

                                  startingBalance
                                      .add(
                                          lotteryEthAmount
                                              .mul(additionalEntrants)
                                              .add(lotteryEthAmount)
                                      )
                                      .toString()
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      const tx = await Lottery.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[1].getBalance()
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          Lottery.address
                      )
                  })
              })
          })
      })
