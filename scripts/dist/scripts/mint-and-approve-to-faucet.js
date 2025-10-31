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
var MockERC20_json_1 = __importDefault(require("../src/lib/contracts/abis/MockERC20.json"));
dotenv.config();
var RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
var PRIVATE_KEY = process.env.PRIVATE_KEY_OWNER;
var METRIK_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS;
var USDC_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS;
var FAUCET_ADDRESS = "0x68b321c8957fc5F78d0F2Da943850b6794E3A394";
// Set the amount to mint and approve (as string, e.g., "1000000")
var METRIK_AMOUNT = "1000000";
var USDC_AMOUNT = "1000000";
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var provider, wallet, metrik, metrikDecimals, metrikAmount, tx, usdc, usdcDecimals, usdcAmount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    provider = new ethers_1.ethers.providers.JsonRpcProvider(RPC_URL);
                    wallet = new ethers_1.ethers.Wallet(PRIVATE_KEY, provider);
                    metrik = new ethers_1.ethers.Contract(METRIK_ADDRESS, MockERC20_json_1.default.abi, wallet);
                    metrikDecimals = 18;
                    metrikAmount = ethers_1.ethers.utils.parseUnits(METRIK_AMOUNT, metrikDecimals);
                    console.log("Minting ".concat(METRIK_AMOUNT, " METRIK to ").concat(wallet.address, "..."));
                    return [4 /*yield*/, metrik.mint(wallet.address, metrikAmount)];
                case 1:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 2:
                    _a.sent();
                    console.log("Minted METRIK. Tx: ".concat(tx.hash));
                    // Approve METRIK to Faucet (full 1,000,000 METRIK)
                    console.log("Approving Faucet to spend ".concat(METRIK_AMOUNT, " METRIK..."));
                    return [4 /*yield*/, metrik.approve(FAUCET_ADDRESS, metrikAmount)];
                case 3:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 4:
                    _a.sent();
                    console.log("Approved METRIK. Tx: ".concat(tx.hash));
                    usdc = new ethers_1.ethers.Contract(USDC_ADDRESS, MockERC20_json_1.default.abi, wallet);
                    usdcDecimals = 6;
                    usdcAmount = ethers_1.ethers.utils.parseUnits(USDC_AMOUNT, usdcDecimals);
                    console.log("Minting ".concat(USDC_AMOUNT, " USDC to ").concat(wallet.address, "..."));
                    return [4 /*yield*/, usdc.mint(wallet.address, usdcAmount)];
                case 5:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 6:
                    _a.sent();
                    console.log("Minted USDC. Tx: ".concat(tx.hash));
                    // Approve USDC to Faucet (full 1,000,000 USDC)
                    console.log("Approving Faucet to spend ".concat(USDC_AMOUNT, " USDC..."));
                    return [4 /*yield*/, usdc.approve(FAUCET_ADDRESS, usdcAmount)];
                case 7:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 8:
                    _a.sent();
                    console.log("Approved USDC. Tx: ".concat(tx.hash));
                    console.log("Done!");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
