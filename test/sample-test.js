const {expect, use} = require('chai');
const {utils} = require('ethers');
const {deployContract, MockProvider, solidity} = require('ethereum-waffle');
const Campaign = require('../artifacts/contracts/Campaign.sol/Campaign.json');
const CampaignFactory = require('../artifacts/contracts/Campaign.sol/CampaignFactory.json');

use(solidity);

describe('Campaign Contract', () => {
  const [account0, account1, account2, account3] = new MockProvider().getWallets();

  let campaignFactory;
  let campaign;

  beforeEach(async () => {
    campaignFactory = await deployContract(account0, CampaignFactory, []);
    campaign = await deployContract(account0, Campaign, [utils.parseEther('0.1'), account0.address]);
    await campaign.deployed();
  });

  it('has a manager', async () => {
    expect(await campaign.manager()).to.eq(account0.address);
  });

  it('has a minimum contribution amount', async () => {
    expect(await campaign.minimumContribution()).to.eq(utils.parseEther('0.1'));
  });

  it('can call the contribute function', async () => {
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1')});
    expect('contribute').to.be.calledOnContract(campaign);
  });

  it('cannot be a contributor without sending the minimum required amount', async () => {
    await expect(campaign.connect(account1).contribute({ value: utils.parseEther('0.005')}))
      .of.be.revertedWith('Not enough contributed to be an approver');
  });

  it('allows a contributor to become an approver, and increases the approver count', async () => {
    expect(await campaign.approversCount()).to.eq(0);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1')});
    expect(await campaign.approvers(account1.address)).to.eq(true);
    expect(await campaign.approversCount()).to.eq(1);
    await campaign.connect(account2).contribute({ value: utils.parseEther('0.1')});
    expect(await campaign.approvers(account2.address)).to.eq(true);
    expect(await campaign.approversCount()).to.eq(2);
  });

  it('only the manager can call the createRequest function', async () => {
    await expect(campaign.connect(account1).createRequest('test description', utils.parseEther('2'), account3.address))
        .to.be.revertedWith('You are not the manager');
  });

  it('creates a new request', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    const request1 = await campaign.requests(0);
    expect(request1.description).to.eq('test description');
  });

});