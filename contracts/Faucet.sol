// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Faucet {
    address public owner;
    address public metrik;
    address public musd; // Changed from usdc to musd

    event Claimed(address indexed user, address indexed token, uint256 amount);
    event Deposited(address indexed from, address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _metrik, address _musd) {
        owner = msg.sender;
        metrik = _metrik;
        musd = _musd;
    }

    // Anyone can claim any amount of metrik or MUSD
    function claim(address token, uint256 amount) external {
        require(token == address(metrik) || token == address(musd), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Faucet empty");
        IERC20(token).transfer(msg.sender, amount);
        emit Claimed(msg.sender, token, amount);
    }

    // Owner can withdraw tokens (in case you want to recover them)
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // Deposit tokens to the faucet (just send tokens to this contract address)
    // Optionally, you can call this to emit an event
    function deposit(address token, uint256 amount) external {
        require(token == address(metrik) || token == address(musd), "Invalid token");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Deposited(msg.sender, token, amount);
    }
} 