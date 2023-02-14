pragma solidity 0.8.2;


import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import './MultiAccessControlUpgradeable.sol';

library Counters {
    using SafeMath for uint256;

    struct Counter {
        // This variable should never be directly accessed by users of the library: interactions must be restricted to
        // the library's function. As of Solidity v0.5.2, this cannot be enforced, though there is a proposal to add
        // this feature: see https://github.com/ethereum/solidity/issues/4637
        uint256 _value; // default: 0
    }

    function current(Counter storage counter) internal view returns (uint256) {
        return counter._value;
    }

    function increment(Counter storage counter) internal {
        // The {SafeMath} overflow check can be skipped here, see the comment at the top
        counter._value = counter._value.add(1);
    }

    function decrement(Counter storage counter) internal {
        counter._value = counter._value.sub(1);
    }
}


contract TestAppNFT is
    ERC721EnumerableUpgradeable, MultiAccessControlUpgradeable
{
    using Counters for Counters.Counter;
    Counters.Counter private nextTokenID;

    bytes32 public constant READ = keccak256("READ");
    bytes32 public constant DEPLOYER = keccak256("DEPLOYER");
    bytes32 public constant ACCESS_MANAGER = keccak256("ACCESS_MANAGER");
    bytes32 public constant BILLING_MANAGER = keccak256("BILLING_MANAGER");
    bytes32 public constant CONTRACT_BASED_DEPLOYER =
        keccak256("CONTRACT_BASED_DEPLOYER");


    function initialize() public initializer {
        __ERC721_init_unchained("ApplicationNFT", "AppNFT");
        __AccessControl_init_unchained();
        nextTokenID.increment();
    }

    function mint(address to)
    external
    {
        uint tokenID = nextTokenID.current();
        _safeMint(to, tokenID);
        nextTokenID.increment();
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public
      override
    {
        super.transferFrom(from, to, tokenId);
        _removeAllRoles(tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        super.safeTransferFrom(from, to, tokenId, "");
        _removeAllRoles(tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public
      override
    {
        super.safeTransferFrom(from, to, tokenId, data);
        _removeAllRoles(tokenId);
    }
    

    function grantRole(
        uint256 nftID,
        bytes32 role,
        address account
    ) public
    virtual
    override
    {
        address owner = ownerOf(nftID);
        require(
            owner == _msgSender()
            || (hasRole(nftID, ACCESS_MANAGER, _msgSender())
                && ((role != BILLING_MANAGER) && (role != ACCESS_MANAGER))
                && (account != owner)
            )
            ,
            "Grant and Revoke role only allowed for NFT owner"
        );
        _grantRole(nftID, role, account);
    }


    function revokeRole(
        uint256 nftID,
        bytes32 role,
        address account
    ) public virtual override {
        address owner = ownerOf(nftID);
        require(
            owner == _msgSender()
            || (hasRole(nftID, ACCESS_MANAGER, _msgSender())
                && ((role != BILLING_MANAGER) && (role != ACCESS_MANAGER))
                && (account != owner)
            )
            ,
            "Grant and Revoke role only allowed for NFT owner"
        );

        _revokeRole(nftID, role, account);
    }


    function getBytes32OfRole(string memory _roleName)
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_roleName));
    }


    function hasRoleOf(
        uint256 nftID,
        string memory _roleName,
        address _account
    ) external view returns (bool) {
        return hasRole(nftID, keccak256(bytes(_roleName)), _account);
    }

    modifier isNFTOwner(uint256 _nftId) {
        require(
            ownerOf(_nftId) == _msgSender()
            || hasRole(_nftId, ACCESS_MANAGER, _msgSender())
            ,
            "Grant and Revoke role only allowed for NFT owner"
        );

        _;
    }
}
