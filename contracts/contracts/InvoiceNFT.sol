// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title InvoiceNFT
 * @dev ERC721 token representing a credit-based invoice with historical tracking
 */
contract InvoiceNFT is ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl {
    uint256 private _nextTokenId;
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct InvoiceDetails {
        string invoiceId;
        address supplier;
        address buyer;
        uint256 creditAmount;
        uint256 dueDate;
        string ipfsHash;
        bool isVerified;
    }

    struct HistoricalInvoiceRecord {
        uint256 tokenId;
        string invoiceId;
        address supplier;
        address buyer;
        uint256 creditAmount;
        uint256 dueDate;
        string ipfsHash;
        bool isVerified;
        uint256 mintTime;
        uint256 burnTime; // 0 if not burned
        bool isBurned;
        string burnReason; // "repayment", "liquidation", "manual", etc.
    }

    // Mapping from token ID to invoice details
    mapping(uint256 => InvoiceDetails) private _invoiceDetails;
    mapping(string => bool) private _usedInvoiceIds;
    
    // Historical tracking
    mapping(uint256 => HistoricalInvoiceRecord) private _historicalRecords;
    mapping(address => uint256[]) private _userMintedTokens; // All tokens minted by user
    mapping(address => uint256[]) private _userBurnedTokens; // All tokens burned by user
    uint256[] private _allMintedTokens; // Array of all token IDs ever minted
    uint256[] private _allBurnedTokens; // Array of all token IDs ever burned
    uint256 private _totalMinted;
    uint256 private _totalBurned;

    // Events
    event InvoiceMinted(
        uint256 indexed tokenId,
        address indexed supplier,
        string invoiceId
    );
    event InvoiceVerified(uint256 indexed tokenId);
    event InvoiceBurned(uint256 indexed tokenId, string reason);

    constructor() ERC721("InvoiceNFT", "INV") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Mints a new invoice NFT
     * @param to Address to mint the NFT to
     * @param invoiceId Unique identifier for the invoice
     * @param creditAmount Credit amount of the invoice
     * @param dueDate Due date of the invoice
     * @param ipfsHash IPFS hash for additional metadata
     * @return tokenId The ID of the newly minted NFT
     */
    function mintInvoiceNFT(
        address to,
        string calldata invoiceId,
        uint256 creditAmount,
        uint256 dueDate,
        string calldata ipfsHash
    ) external returns (uint256) {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        require(!_usedInvoiceIds[invoiceId], "Invoice ID already used");
        require(creditAmount > 0, "Credit amount must be greater than 0");
        require(dueDate > block.timestamp, "Due date must be in the future");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, ipfsHash);

        _invoiceDetails[tokenId] = InvoiceDetails({
            invoiceId: invoiceId,
            supplier: to, // The supplier is the one who receives the NFT
            buyer: msg.sender, // The buyer is the one who mints
            creditAmount: creditAmount,
            dueDate: dueDate,
            ipfsHash: ipfsHash,
            isVerified: false
        });

        // Create historical record
        _historicalRecords[tokenId] = HistoricalInvoiceRecord({
            tokenId: tokenId,
            invoiceId: invoiceId,
            supplier: to,
            buyer: msg.sender,
            creditAmount: creditAmount,
            dueDate: dueDate,
            ipfsHash: ipfsHash,
            isVerified: false,
            mintTime: block.timestamp,
            burnTime: 0,
            isBurned: false,
            burnReason: ""
        });

        // Track user's minted tokens
        _userMintedTokens[to].push(tokenId);
        _allMintedTokens.push(tokenId);
        _totalMinted++;

        _usedInvoiceIds[invoiceId] = true;

        emit InvoiceMinted(tokenId, to, invoiceId);
        return tokenId;
    }

    /**
     * @dev Returns the details of an invoice
     * @param tokenId The ID of the NFT
     * @return InvoiceDetails struct containing all invoice information
     */
    function getInvoiceDetails(uint256 tokenId) external view returns (InvoiceDetails memory) {
        require(_exists(tokenId), "Invoice does not exist");
        return _invoiceDetails[tokenId];
    }

    /**
     * @dev Returns historical record of an invoice (works even if burned)
     * @param tokenId The ID of the NFT
     * @return HistoricalInvoiceRecord struct containing all historical information
     */
    function getHistoricalInvoiceRecord(uint256 tokenId) external view returns (HistoricalInvoiceRecord memory) {
        require(_historicalRecords[tokenId].tokenId != 0, "Invoice never existed");
        return _historicalRecords[tokenId];
    }

    /**
     * @dev Marks an invoice as verified (only callable by verifier)
     * @param tokenId The ID of the NFT to verify
     */
    function verifyInvoice(uint256 tokenId) external {
        require(hasRole(VERIFIER_ROLE, msg.sender), "Caller is not a verifier");
        require(_exists(tokenId), "Invoice does not exist");
        require(!_invoiceDetails[tokenId].isVerified, "Invoice already verified");
        
        _invoiceDetails[tokenId].isVerified = true;
        _historicalRecords[tokenId].isVerified = true;
        
        emit InvoiceVerified(tokenId);
    }

    /**
     * @dev Checks if an invoice is verified
     * @param tokenId The ID of the NFT
     * @return bool True if the invoice is verified
     */
    function isVerified(uint256 tokenId) external view returns (bool) {
        require(_exists(tokenId), "Invoice does not exist");
        return _invoiceDetails[tokenId].isVerified;
    }

    /**
     * @dev Burn an invoice NFT with reason
     * @param tokenId ID of the invoice NFT
     * @param reason Reason for burning (e.g., "repayment", "liquidation", "manual")
     */
    function burn(uint256 tokenId, string calldata reason) external {
        _burnWithReason(tokenId, reason);
    }

    /**
     * @dev Legacy burn function for backward compatibility
     * @param tokenId ID of the invoice NFT
     */
    function burnLegacy(uint256 tokenId) external {
        _burnWithReason(tokenId, "manual");
    }

    /**
     * @dev Internal burn function with reason
     * @param tokenId ID of the invoice NFT
     * @param reason Reason for burning
     */
    function _burnWithReason(uint256 tokenId, string memory reason) internal {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner ||
            getApproved(tokenId) == msg.sender ||
            isApprovedForAll(owner, msg.sender),
            "Not approved or owner"
        );
        
        // Update historical record before burning
        _historicalRecords[tokenId].burnTime = block.timestamp;
        _historicalRecords[tokenId].isBurned = true;
        _historicalRecords[tokenId].burnReason = reason;
        
        // Track burned tokens
        _userBurnedTokens[owner].push(tokenId);
        _allBurnedTokens.push(tokenId);
        _totalBurned++;
        
        _burn(tokenId);
        emit InvoiceBurned(tokenId, reason);
    }

    /**
     * @dev Get all tokens minted by a user (including burned ones)
     * @param user Address of the user
     * @return Array of token IDs
     */
    function getUserMintedTokens(address user) external view returns (uint256[] memory) {
        return _userMintedTokens[user];
    }

    /**
     * @dev Get all tokens burned by a user
     * @param user Address of the user
     * @return Array of token IDs
     */
    function getUserBurnedTokens(address user) external view returns (uint256[] memory) {
        return _userBurnedTokens[user];
    }

    /**
     * @dev Get all tokens ever minted
     * @return Array of token IDs
     */
    function getAllMintedTokens() external view returns (uint256[] memory) {
        return _allMintedTokens;
    }

    /**
     * @dev Get all tokens ever burned
     * @return Array of token IDs
     */
    function getAllBurnedTokens() external view returns (uint256[] memory) {
        return _allBurnedTokens;
    }

    /**
     * @dev Get total count of minted and burned tokens
     * @return totalMinted Total number of tokens ever minted
     * @return totalBurned Total number of tokens ever burned
     * @return totalActive Total number of active tokens
     */
    function getTokenStatistics() external view returns (uint256 totalMinted, uint256 totalBurned, uint256 totalActive) {
        totalMinted = _totalMinted;
        totalBurned = _totalBurned;
        totalActive = totalMinted - totalBurned;
    }

    /**
     * @dev Get user's invoice statistics
     * @param user Address of the user
     * @return totalMinted Total tokens minted by user
     * @return totalBurned Total tokens burned by user
     * @return totalActive Total active tokens for user
     * @return totalCreditAmount Total credit amount of all user's invoices
     */
    function getUserInvoiceStatistics(address user) external view returns (
        uint256 totalMinted,
        uint256 totalBurned,
        uint256 totalActive,
        uint256 totalCreditAmount
    ) {
        totalMinted = _userMintedTokens[user].length;
        totalBurned = _userBurnedTokens[user].length;
        totalActive = totalMinted - totalBurned;
        
        // Calculate total credit amount from historical records
        for (uint256 i = 0; i < _userMintedTokens[user].length; i++) {
            uint256 tokenId = _userMintedTokens[user][i];
            totalCreditAmount += _historicalRecords[tokenId].creditAmount;
        }
    }

    /**
     * @dev Get paginated historical records for a user
     * @param user Address of the user
     * @param offset Starting index
     * @param limit Maximum number of records to return
     * @return records Array of HistoricalInvoiceRecord structs
     * @return totalCount Total number of records for the user
     */
    function getUserHistoricalRecords(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (HistoricalInvoiceRecord[] memory records, uint256 totalCount) {
        uint256[] memory userTokens = _userMintedTokens[user];
        totalCount = userTokens.length;
        
        uint256 endIndex = offset + limit;
        if (endIndex > totalCount) {
            endIndex = totalCount;
        }
        
        uint256 resultCount = endIndex > offset ? endIndex - offset : 0;
        records = new HistoricalInvoiceRecord[](resultCount);
        
        for (uint256 i = offset; i < endIndex; i++) {
            records[i - offset] = _historicalRecords[userTokens[i]];
        }
    }

    /**
     * @dev Search invoices by invoice ID (works for burned invoices too)
     * @param invoiceId The invoice ID to search for
     * @return tokenId The token ID if found, 0 if not found
     * @return record The historical record if found
     */
    function searchInvoiceById(string calldata invoiceId) external view returns (uint256 tokenId, HistoricalInvoiceRecord memory record) {
        for (uint256 i = 0; i < _allMintedTokens.length; i++) {
            uint256 currentTokenId = _allMintedTokens[i];
            if (keccak256(bytes(_historicalRecords[currentTokenId].invoiceId)) == keccak256(bytes(invoiceId))) {
                tokenId = currentTokenId;
                record = _historicalRecords[currentTokenId];
                return (tokenId, record);
            }
        }
        return (0, record);
    }

    /**
     * @dev Get invoices by date range
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return records Array of HistoricalInvoiceRecord structs
     */
    function getInvoicesByDateRange(uint256 startTime, uint256 endTime) external view returns (HistoricalInvoiceRecord[] memory records) {
        uint256 count = 0;
        
        // First pass: count matching records
        for (uint256 i = 0; i < _allMintedTokens.length; i++) {
            uint256 tokenId = _allMintedTokens[i];
            uint256 mintTime = _historicalRecords[tokenId].mintTime;
            if (mintTime >= startTime && mintTime <= endTime) {
                count++;
            }
        }
        
        // Second pass: collect matching records
        records = new HistoricalInvoiceRecord[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _allMintedTokens.length; i++) {
            uint256 tokenId = _allMintedTokens[i];
            uint256 mintTime = _historicalRecords[tokenId].mintTime;
            if (mintTime >= startTime && mintTime <= endTime) {
                records[index] = _historicalRecords[tokenId];
                index++;
            }
        }
    }

    /**
     * @dev Override _update to prevent transfers of unverified invoices
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        require(
            _invoiceDetails[tokenId].isVerified || 
            hasRole(VERIFIER_ROLE, msg.sender) || 
            auth == address(0x0) || // Allow minting
            msg.sender == address(0x0), // Allow minting
            "Invoice must be verified before transfer"
        );
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Returns whether the specified token exists
     * @param tokenId uint256 ID of the token to query the existence of
     * @return bool whether the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // The following functions are overrides required by Solidity
    function _increaseBalance(address account, uint128 amount)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, amount);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 