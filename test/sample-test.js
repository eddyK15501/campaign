const chai = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');
const { solidity } = require('ethereum-waffle');
const { parseEther } = require('ethers/lib/utils');

chai.use(solidity);
const { expect } = chai;

let campaignFactory;
let campaign;

beforeEach(async () => {
    [account0, account1, account2, account3] = await ethers.getSigners();

    const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    campaignFactory = await CampaignFactory.deploy();
    await campaignFactory.deployed();

    const Campaign = await ethers.getContractFactory("Campaign");
    campaign = await Campaign.deploy(utils.parseEther('0.1'), account0.address);
    await campaign.deployed();
});

describe('New Campaign', () => {
  it('has a manager', async () => {
    expect(await campaign.manager()).to.eq(account0.address);
  });

  it('has a minimum contribution amount', async () => {
    expect(await campaign.minimumContribution()).to.eq(utils.parseEther('0.1'));
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
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account2.address);
    await campaign.connect(account0).createRequest('test description two', utils.parseEther('5'), account3.address);
    const request1 = await campaign.requests(0);
    const request2 = await campaign.requests(1);
    expect(request1.description).to.eq('test description');
    expect(request1.value).to.eq(utils.parseEther('2'));
    expect(request1.recipient).to.eq(account2.address);
    expect(request1.complete).to.eq(false);
    expect(request1.approvalCount).to.eq(0);

    expect(request2.description).to.eq('test description two');
    expect(request2.value).to.eq(utils.parseEther('5'));
    expect(request2.recipient).to.eq(account3.address);
    expect(request2.complete).to.eq(false);
    expect(request2.approvalCount).to.eq(0);
  });

  it('increases the number of requests by 1', async () => {
    expect(await campaign.numberOfRequests()).to.eq(0);
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    expect(await campaign.numberOfRequests()).to.eq(1);
  });

  it('must be an approver before calling the approveRequest function', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await expect(campaign.connect(account1).approveRequest(0)).to.be.revertedWith('You are not approved');
  });

  it('must count track of whether the approver has voted or not, as well as how many have voted so far', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1') });
    expect((await campaign.requests(0)).approvalCount).to.eq(0);
    await campaign.connect(account1).approveRequest(0);
    expect((await campaign.requests(0)).approvalCount).to.eq(1);
  });

  it('must reject any approvers that have already voted', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1') });
    await campaign.connect(account1).approveRequest(0);
    await expect(campaign.connect(account1).approveRequest(0)).to.be.revertedWith('Already voted');
  });

  it('only owner can call the finalizeRequest function', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1') });
    await campaign.connect(account2).contribute({ value: utils.parseEther('0.5') });
    await campaign.connect(account1).approveRequest(0);
    await campaign.connect(account2).approveRequest(0);
    await expect(campaign.connect(account1).finalizeRequest(0))
      .to.be.revertedWith('You are not the manager');
  });

  it('must have more or equal amount of votes than half the total number of voters', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1') });
    await campaign.connect(account2).contribute({ value: utils.parseEther('0.5') });
    await campaign.connect(account1).approveRequest(0);
    await campaign.connect(account2).approveRequest(0);
    expect((await campaign.requests(0)).approvalCount).to.eq(2);
  });

  it('must transfer the amount to the recipient', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address);
    await campaign.connect(account1).contribute({ value: utils.parseEther('0.1') });
    await campaign.connect(account2).contribute({ value: utils.parseEther('0.5') });
    await campaign.connect(account1).approveRequest(0);
    await campaign.connect(account2).approveRequest(0);

    const balanceBefore = utils.formatEther(await account3.getBalance());
    await campaign.connect(account0).finalizeRequest(0);
      //await campaign.connect(account0).finalizeRequest(0, { gasLimit: ethers.utils.hexlify(2100000), gasPrice: ethers.utils.parseUnits('500', 'gwei') });
      //HOW TO SPECIFY THE GAS PRICE AND GAS LIMIT OF A FUNCTION
    const balanceAfter = utils.formatEther(await account3.getBalance());

    expect(parseFloat(balanceAfter) - parseFloat(balanceBefore)).to.be.closeTo(0.6, 1e-3);
    expect(await ethers.provider.getBalance(campaign.address)).to.be.equal(0);
  });

  it('must complete the request', async () => {
    await campaign.connect(account0).createRequest('test description', utils.parseEther('2'), account3.address)
    await campaign.connect(account1).contribute({ value: parseEther('0.1') });
    await campaign.connect(account2).contribute({ value: parseEther('0.5') });
    await campaign.connect(account1).approveRequest(0);
    await campaign.connect(account2).approveRequest(0);
    expect((await campaign.requests(0)).complete).to.be.equal(false);
    await campaign.connect(account0).finalizeRequest(0);
    expect((await campaign.requests(0)).complete).to.be.equal(true);    
  });

  describe("New Campaign Factory", () => {
    it('can create a new Campaign contract', async () => {
      await campaignFactory.connect(account0).createCampaign(utils.parseEther('0.1'));
      await campaignFactory.connect(account1).createCampaign(utils.parseEther('0.2'));

      expect(await campaignFactory.getDeployedCampaigns()).to.have.lengthOf(2);
      
      console.log(utils.getAddress(await campaignFactory.deployedCampaigns(0)));
      console.log(utils.getAddress(await campaignFactory.deployedCampaigns(1)));
    });
  });
});