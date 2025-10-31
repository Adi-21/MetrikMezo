"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ethers_1 = require("ethers");
var dotenv = __importStar(require("dotenv"));
// If you haven't already, run: npm install dotenv @types/dotenv --save-dev
var InvoiceNFT_json_1 = __importDefault(require("../src/lib/contracts/abis/InvoiceNFT.json"));
var invoiceNFTAbi = InvoiceNFT_json_1.default.abi;
dotenv.config();
var RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
var PRIVATE_KEY_ADMIN = process.env.PRIVATE_KEY_OWNER; // Admin who can grant roles
var INVOICE_NFT_ADDRESS = process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS;
var SUPPLIER_ADDRESS = process.env.SUPPLIER_ADDRESS; // Add this to your .env
var OWNER_ADDRESS = process.env.OWNER_ADDRESS; // Add this to your .env
// Role hashes (keccak256)
var MINTER_ROLE = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.toUtf8Bytes("MINTER_ROLE"));
var VERIFIER_ROLE = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var provider, wallet, contract, hasMinter, tx, hasVerifier, tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!RPC_URL || !PRIVATE_KEY_ADMIN || !INVOICE_NFT_ADDRESS || !SUPPLIER_ADDRESS || !OWNER_ADDRESS) {
                        throw new Error("Missing required environment variables. Check your .env file.");
                    }
                    provider = new ethers_1.ethers.providers.JsonRpcProvider(RPC_URL);
                    wallet = new ethers_1.ethers.Wallet(PRIVATE_KEY_ADMIN, provider);
                    contract = new ethers_1.ethers.Contract(INVOICE_NFT_ADDRESS, invoiceNFTAbi, wallet);
                    return [4 /*yield*/, contract.hasRole(MINTER_ROLE, SUPPLIER_ADDRESS)];
                case 1:
                    hasMinter = _a.sent();
                    if (!!hasMinter) return [3 /*break*/, 4];
                    console.log("Granting MINTER_ROLE to ".concat(SUPPLIER_ADDRESS, "..."));
                    return [4 /*yield*/, contract.grantRole(MINTER_ROLE, SUPPLIER_ADDRESS)];
                case 2:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 3:
                    _a.sent();
                    console.log("MINTER_ROLE granted!");
                    return [3 /*break*/, 5];
                case 4:
                    console.log("Supplier already has MINTER_ROLE.");
                    _a.label = 5;
                case 5: return [4 /*yield*/, contract.hasRole(VERIFIER_ROLE, OWNER_ADDRESS)];
                case 6:
                    hasVerifier = _a.sent();
                    if (!!hasVerifier) return [3 /*break*/, 9];
                    console.log("Granting VERIFIER_ROLE to ".concat(OWNER_ADDRESS, "..."));
                    return [4 /*yield*/, contract.grantRole(VERIFIER_ROLE, OWNER_ADDRESS)];
                case 7:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 8:
                    _a.sent();
                    console.log("VERIFIER_ROLE granted!");
                    return [3 /*break*/, 10];
                case 9:
                    console.log("Owner already has VERIFIER_ROLE.");
                    _a.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
