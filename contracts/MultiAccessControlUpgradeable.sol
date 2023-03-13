// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (access/AccessControl.sol)

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it.
 */
abstract contract MultiAccessControlUpgradeable is Initializable, ContextUpgradeable {
    function __AccessControl_init() internal onlyInitializing {
    }

    function __AccessControl_init_unchained() internal onlyInitializing {
    }

    struct MemberData {
        uint256 userRoleID;
        uint256 memberID;
        address member;
        bool active;
    }

    struct RoleData {
        mapping(address => MemberData) memberMap;
        address[] memberList;
        bytes32 adminRole;
    }

    struct UserRole {
        uint256 nftID;
        bytes32 role;
    }

    mapping(uint256 => bytes32[]) private nftRoleList;
    mapping(uint256 => mapping(bytes32 => RoleData)) private nftToAccountRoles;
    mapping(uint256 => mapping(bytes32 => mapping(address => bool))) hasRoleMap;

    mapping(address => UserRole[]) private accountToNFTRoles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    event RoleAdminChanged(uint _appId, bytes32 role, bytes32 prevAdminRole, bytes32 adminRole);
    event RoleGranted(uint _appId, bytes32 role, address account, address sender);
    event RoleRevoked(uint _appId, bytes32 role, address account, address sender);


    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     *
     * _Available since v4.1._
     */
    modifier onlyRole(uint _appId, bytes32 role) {
        _checkRole(_appId, role);
        _;
    }

 
    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(uint appID, bytes32 role, address account)
    public
    view
    virtual 
    returns (bool) {

        return nftToAccountRoles[appID][role].memberMap[account].active;
    }

    /**
     * @dev Revert with a standard message if `_msgSender()` is missing `role`.
     * Overriding this function changes the behavior of the {onlyRole} modifier.
     *
     * Format of the revert message is described in {_checkRole}.
     *
     * _Available since v4.6._
     */
    function _checkRole(uint _appId, bytes32 role) internal view virtual {
        _checkRole(_appId, role, _msgSender());
    }

    /**
     * @dev Revert with a standard message if `account` is missing `role`.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     */
    function _checkRole(uint _appId, bytes32 role, address account) internal view virtual {
        require (hasRole(_appId, role, account), "MultiAccessControl: account is missing role");
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(uint appID, bytes32 role) public view virtual  returns (bytes32) {
        return nftToAccountRoles[appID][role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(uint _appId, bytes32 role, address account) public virtual  onlyRole(_appId, getRoleAdmin(_appId, role)) {
        _grantRole(_appId, role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(uint _appId, bytes32 role, address account) public virtual  onlyRole(_appId, getRoleAdmin(_appId, role)) {
        _revokeRole(_appId, role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `account`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(uint _appId, bytes32 role, address account) public virtual  {
        require(account == _msgSender(), "AccessControl: can only renounce roles for self");

        _revokeRole(_appId, role, account);
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event. Note that unlike {grantRole}, this function doesn't perform any
     * checks on the calling account.
     *
     * May emit a {RoleGranted} event.
     *
     * [WARNING]
     * ====
     * This function should only be called from the constructor when setting
     * up the initial roles for the system.
     *
     * Using this function in any other way is effectively circumventing the admin
     * system imposed by {AccessControl}.
     * ====
     *
     * NOTE: This function is deprecated in favor of {_grantRole}.
     */
    function _setupRole(uint _appId, bytes32 role, address account) internal virtual {
        _grantRole(_appId, role, account);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(uint _appId, bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(_appId, role);
        nftToAccountRoles[_appId][role].adminRole = adminRole;
        emit RoleAdminChanged(_appId, role, previousAdminRole, adminRole);
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(uint appID, bytes32 role, address account) internal virtual {
        if (!hasRole(appID, role, account))
        {

            if(nftToAccountRoles[appID][role].memberList.length == 0)
            {
                nftRoleList[appID].push(role);
            }

            nftToAccountRoles[appID][role].memberMap[account].memberID
                 = nftToAccountRoles[appID][role].memberList.length;

            nftToAccountRoles[appID][role].memberMap[account].userRoleID
                = accountToNFTRoles[account].length;

            
            nftToAccountRoles[appID][role].memberMap[account].active = true;

            nftToAccountRoles[appID][role].memberList.push(
                account
            );

            accountToNFTRoles[account].push(
                UserRole(
                    appID,
                    role
                )
            );

            emit RoleGranted(appID, role, account, _msgSender());
        }
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(uint appID, bytes32 role, address account) internal virtual {
        if (hasRole(appID, role, account))
        {

            uint256 memberID = nftToAccountRoles[appID][role].memberMap[account].memberID;
            uint256 userRoleID = nftToAccountRoles[appID][role].memberMap[account].userRoleID;

            nftToAccountRoles[appID][role].memberMap[account].active = false;


            delete nftToAccountRoles[appID][role].memberList[memberID];

            delete accountToNFTRoles[account][userRoleID];

            
            emit RoleRevoked(appID, role, account, _msgSender());
        }
    }
    
    function _removeAllRoles(uint256 nftID)
    internal
    virtual
    {
        for(uint256 i = 0; i < nftRoleList[nftID].length; i++)
        {
            bytes32 role = nftRoleList[nftID][i];
            address[] memory memberList = nftToAccountRoles[nftID][role].memberList;
            for(uint256 j = 0; j < memberList.length; j++)
            {
                address member = memberList[j];

                if(!nftToAccountRoles[nftID][role].memberMap[member].active)
                    continue;
                
                uint256 userRoleID = nftToAccountRoles[nftID][role].memberMap[member].userRoleID;

                delete accountToNFTRoles[member][userRoleID];
            }

            delete nftToAccountRoles[nftID][role];
        }

    }

    function getAllRolesFromAccount(address account)
    external
    view
    returns (UserRole[] memory)
    {
        return accountToNFTRoles[account];
    }

    function getAccountsWithRole(uint256 appId, bytes32 role)
    external
    view
    returns (address[] memory)
    {
        return nftToAccountRoles[appId][role].memberList;
    }
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}