pragma solidity 0.8.2;


import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

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


contract TestDarkMatter is
    ERC721EnumerableUpgradeable
{
    using Counters for Counters.Counter;
    Counters.Counter private nextTokenID;


    function initialize() public initializer {
        __ERC721_init_unchained("TestDarkMatter", "TestDarkMatter");
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
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        super.safeTransferFrom(from, to, tokenId, "");
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
    }
    

}
