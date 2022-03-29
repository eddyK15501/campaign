//SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "hardhat/console.sol";

contract CampaignFactory {
    address[] public deployedCampaigns;

    function createCampaign(uint256 _minimum) public {
        address newCampaign = address(new Campaign(_minimum, msg.sender));
        deployedCampaigns.push(newCampaign);
    }

    function getDeployedCampaigns() public view returns (address[] memory) {
        return deployedCampaigns;
    }
}

contract Campaign {
    struct Request {
        string description;
        uint256 value;
        address payable recipient;
        bool complete;
        uint256 approvalCount;
        mapping(address => bool) approvals;
    }

    uint256 private currentIndex;

    uint256 public approversCount;
    uint256 public minimumContribution;
    uint256 public numberOfRequests;
    address public manager;

    mapping(address => bool) public approvers;
    mapping(uint256 => Request) public requests;

    constructor(uint256 _minimum, address _manager) {
        manager = _manager;
        minimumContribution = _minimum;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "You are not the manager");
        _;
    }

    function contribute() public payable {
        require(
            msg.value >= minimumContribution,
            "Not enough contributed to be an approver"
        );

        approvers[msg.sender] = true;
        approversCount++;
    }

    function createRequest(
        string memory _description,
        uint256 _value,
        address payable _recipient
    ) public onlyManager {
        Request storage newRequest = requests[currentIndex++];
        newRequest.description = _description;
        newRequest.value = _value;
        newRequest.recipient = _recipient;
        newRequest.complete = false;
        newRequest.approvalCount = 0;

        numberOfRequests++;
    }

    function approveRequest(uint256 index) public {
        Request storage request = requests[index];
        require(approvers[msg.sender], "You are not approved");
        require(!request.approvals[msg.sender], "Already voted");

        console.log("msg.sender: ", msg.sender);
        console.log("Request approvals should be false: ", request.approvals[msg.sender]);

        request.approvals[msg.sender] = true;
        request.approvalCount++;
    }

    function finalizeRequest(uint256 index) public onlyManager {
        Request storage request = requests[index];
        require(request.approvalCount >= (approversCount / 2));
        require(!request.complete);

        (bool success,) = request.recipient.call{value: address(this).balance}("");
        require(success, "Failed to send Ether");

        request.complete = true;
    }

    function getSummary()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            address
        )
    {
        return (
            address(this).balance,
            minimumContribution,
            numberOfRequests,
            approversCount,
            manager
        );
    }
}
