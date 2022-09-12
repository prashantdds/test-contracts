// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity 0.8.2;

import "./TokensRecoverable.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IERC20Mintable.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract XCTMinter is
    AccessControlUpgradeable,
    TokensRecoverable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;

    IERC20Upgradeable StackToken;
    IERC20Mintable XCTToken;
    IERC20Upgradeable USDCToken;
    address public WETH;
    address public TREASURY_ADDRESS;

    IUniswapV2Router02 private uniswapV2Router;
    IUniswapV2Factory private uniswapV2Factory;

    uint256 public slippage;
    uint256 public percentStackConversion;
    uint256 public percentStackAdvantage;

    uint256 public totalXCTMintedByContract;

    event SlippageSet(uint256 slippage);
    event PercentStackSet(
        uint256 percentStackConversion,
        uint256 percentStackAdvantage
    );
    event XCTBought(
        address TokenAddress,
        uint256 tokenAmount,
        uint256 XCTAmount
    );
    event ChangedStackTokenAddress(IERC20Upgradeable oldStackAddress, IERC20Upgradeable newStackAddress);
    event XCTSold(address account, uint256 tokens);
    event TreasuryAddressChanged(address treasury_address);

    function initialize(
        IERC20Upgradeable _StackToken,
        IERC20Mintable _XCTToken,
        IERC20Upgradeable _USDCToken,
        address _admin,
        address _WETH,
        address _TREASURY_ADDRESS,
        uint256 _slippage,
        uint256 _percentStackConversion,
        uint256 _percentStackAdvantage
    ) public initializer {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();
        __ReentrancyGuard_init_unchained();

        uniswapV2Router = IUniswapV2Router02(
            0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
        );
        uniswapV2Factory = IUniswapV2Factory(
            0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32
        );

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        StackToken = _StackToken;
        XCTToken = _XCTToken;
        USDCToken = _USDCToken;
        WETH = _WETH;
        TREASURY_ADDRESS = _TREASURY_ADDRESS;

        totalXCTMintedByContract = 0;
        slippage = _slippage; // 5000 for 5%
        percentStackConversion = _percentStackConversion; // 10000 for 10% and remaining to mint XCT
        percentStackAdvantage = _percentStackAdvantage; // 5000 for 5% and remaining to mint XCT

        IERC20Upgradeable(WETH).approve(address(uniswapV2Router), type(uint).max);

    }

    function changeStackTokenAddress(IERC20Upgradeable _newStackToken) external onlyRole(DEFAULT_ADMIN_ROLE){
        emit ChangedStackTokenAddress(StackToken, _newStackToken);
        StackToken = _newStackToken;
    }

    // 3 decimal =>1000 = 1% =>
    function setSlippage(uint256 _slippage)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_slippage < 100000, "Cant be more than 100%");
        slippage = _slippage;
        emit SlippageSet(slippage);
    }

    function setPercentStack(
        uint256 _percentStackConversion,
        uint256 _percentStackAdvantage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_percentStackConversion < 100000, "Cant be more than 100%");
        require(_percentStackAdvantage < 100000, "Cant be more than 100%");
        percentStackConversion = _percentStackConversion;
        percentStackAdvantage = _percentStackAdvantage;
        emit PercentStackSet(_percentStackConversion, _percentStackAdvantage);
    }

    function setTreasuryAddress(address _new_treasury_address)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_new_treasury_address != address(0), "Cant be zero address");
        TREASURY_ADDRESS = _new_treasury_address;
        emit TreasuryAddressChanged(_new_treasury_address);
    }

    function estimateBuyFromStack(uint256 _stackTokensAmount)
        public
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = address(StackToken);
        path[1] = address(USDCToken);
        uint256 factor = 100000 - percentStackAdvantage;
        uint256[] memory amounts = uniswapV2Router.getAmountsOut(
            _stackTokensAmount.mul(factor).div(100000),
            path
        );
        return amounts[1];
    }

    function estimateBuyFromAnyToken(address _token, uint256 _tokensAmount)
        public
        view
        returns (uint256)
    {
        address[] memory path = new address[](3);
        path[0] = _token;
        path[1] = WETH;
        path[2] = address(USDCToken);
        uint256 factor = 100000 - percentStackConversion;
        uint256[] memory amounts = uniswapV2Router.getAmountsOut(
            _tokensAmount.mul(factor).div(100000),
            path
        );
        return amounts[2];
    }

    function estimateBuy(uint256 _amount)
        public
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = WETH;
        path[2] = address(USDCToken);
        uint256 factor = 100000 - percentStackConversion;
        uint256[] memory amounts = uniswapV2Router.getAmountsOut(
            _amount.mul(factor).div(100000),
            path
        );
        return amounts[2];
    }

    function easyBuyXCT()
        public
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 XCTamount)
    {
        uint256 slippageFactor = (SafeMathUpgradeable.sub(100000, slippage))
            .div(1000); // 100 - slippage => will return like 98000/1000 = 98 for default
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = address(StackToken);

        uint256 amountForStack = msg.value.mul(percentStackConversion).div(
            100000
        );
        uint256[] memory amounts = uniswapV2Router.getAmountsOut(
            amountForStack.mul(percentStackConversion).div(100000),
            path
        );

        uniswapV2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: amountForStack
        }(
            amounts[1].mul(slippageFactor).div(100),
            path,
            TREASURY_ADDRESS,
            block.timestamp
        );

        address[] memory path2 = new address[](2);
        path2[0] = WETH;
        path2[1] = address(USDCToken);
        uint256 amountForUSDC = msg
            .value
            .mul(100000 - percentStackConversion)
            .div(100000);

        uint256[] memory amounts2 = uniswapV2Router.getAmountsOut(
            amountForStack.mul(100000 - percentStackConversion).div(100000),
            path2
        );

        uint prevUSDC = USDCToken.balanceOf(address(this));
        uniswapV2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: amountForUSDC
        }(
            amounts2[1].mul(slippageFactor).div(100),
            path2,
            address(this),
            block.timestamp
        );

        uint usdcReceived = USDCToken.balanceOf(address(this)).sub(prevUSDC);
        XCTToken.mint(msg.sender, usdcReceived);
        totalXCTMintedByContract = totalXCTMintedByContract.add(usdcReceived);

        emit XCTBought(WETH, msg.value, usdcReceived);
        return usdcReceived;
    }

    function buyXCT(address _token, uint256 _tokenAmount)
        public
        nonReentrant
        whenNotPaused
        returns (uint256 XCTamount)
    {
        IERC20Upgradeable(_token).transferFrom(msg.sender, address(this), _tokenAmount);
        IERC20Upgradeable(_token).approve(
            address(uniswapV2Router),
            _tokenAmount
        );
        uint256 slippageFactor = (SafeMathUpgradeable.sub(100000, slippage))
            .div(1000); // 100 - slippage => will return like 98000/1000 = 98 for default
        uint256 percentConv = percentStackConversion;
        if (_token == address(StackToken)) {
            percentConv = percentStackAdvantage;
            StackToken.transfer(TREASURY_ADDRESS, _tokenAmount.mul(percentConv).div(100000));
        }
        else{
            address[] memory path = new address[](3);
            path[0] = _token;
            path[1] = WETH;
            path[2] = address(StackToken);

            uint256 amountForStack = _tokenAmount.mul(percentConv).div(100000);
            uint256[] memory amounts = uniswapV2Router.getAmountsOut(
                amountForStack.mul(percentConv).div(100000),
                path
            );
            uniswapV2Router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountForStack,
                amounts[2].mul(slippageFactor).div(100),
                path,
                TREASURY_ADDRESS,
                block.timestamp
            );
        }
        uint256 amountForUSDC = _tokenAmount.mul(100000 - percentConv).div(
            100000
        );
        uint usdcReceived=0;
        if (_token == address(USDCToken)) 
            usdcReceived = amountForUSDC;
        else{
            address[] memory path2 = new address[](3);
            path2[0] = _token;
            path2[1] = WETH;
            path2[2] = address(USDCToken);

            uint256[] memory amounts2 = uniswapV2Router.getAmountsOut(
                amountForUSDC.mul(100000 - percentConv).div(100000),
                path2
            );

            uint prevUSDC = USDCToken.balanceOf(address(this));
            uniswapV2Router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountForUSDC,
                amounts2[2].mul(slippageFactor).div(100),
                path2,
                address(this),
                block.timestamp
            );
            usdcReceived = USDCToken.balanceOf(address(this)).sub(prevUSDC);
        }
        XCTToken.mint(msg.sender, usdcReceived);
        totalXCTMintedByContract = totalXCTMintedByContract.add(usdcReceived);
        emit XCTBought(_token, _tokenAmount, usdcReceived);
        return usdcReceived;
    }

    function sellXCT(uint256 _amountXCT)
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        XCTToken.burnFrom(msg.sender, _amountXCT);
        totalXCTMintedByContract = totalXCTMintedByContract.sub(_amountXCT);
        USDCToken.transfer(msg.sender, _amountXCT);
        emit XCTSold(msg.sender, _amountXCT);
        return _amountXCT;
    }
}
