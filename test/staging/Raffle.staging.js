const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", function () {
          let Lottery, deployer, lotteryEthAmount
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              Lottery = await ethers.getContract("Lottery", deployer)
              lotteryEthAmount = await Lottery.getEthAmount()
          })

          describe("Fulfill Words", async function () {
              it("pick a winner, reset the lottery, and send the money", async function () {
                  const startingTimeStamp = await Lottery.getLastTimeStamp()
                  const accounts = await ethers.getSigners()
                  await new Promise(async (resolve, reject) => {
                      console.log("begin")
                      Lottery.once("winnerAddress", async function () {
                          console.log("winner")
                          try {
                              const recentWinner = await Lottery.getRecentWinner()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const raffleState = await Lottery.getRaffleState()
                              const endingTimeStamp = await Lottery.getLastTimeStamp()
                              // Now lets get the ending values...
                              console.log("aaaa")
                              await expect(Lottery.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState, 0)
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEthAmount).toString()
                              )
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      console.log("trans")
                      const tx = await Lottery.fundLottery({ value: lotteryEthAmount })
                      await tx.wait(1)
                      console.log("Ok, time to wait...")
                      const winnerStartingBalance = await accounts[0].getBalance()
                      console.log("balance")
                  })
              })
          })
      })
