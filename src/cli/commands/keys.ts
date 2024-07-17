import logger from "../../utils/log";
import { ConfigManager } from "../../utils/managers/config.manager";
import { KeyManager, type KeyData } from "../../utils/managers/key.manager";
import password from "@inquirer/password";
import confirm from "@inquirer/confirm";
import { EnglishMnemonic } from "@cosmjs/crypto";

const log = logger("command:keys");
const keys = new KeyManager();
const config = new ConfigManager();

async function addKeys(name: string): Promise<void> {
  try {
    const mnemonics = await keys.createNewMnemonics();
    await keys.writeKeysDataToFile(name, { mnemonics, name });
    log.info(`Keys added successfully for ${name}`);
  } catch (error) {
    log.error(`Failed to add keys for ${name}:`, error);
    throw error;
  }
}

async function recoverKeys(name: string): Promise<void> {
  try {
    const mnemonics = await password({
      message: "Enter your mnemonic",
      mask: true,
      validate: (input: string) => {
        try {
          new EnglishMnemonic(input);
          return true;
        } catch {
          return "Invalid mnemonic. Please try again.";
        }
      },
    });
    
    const mnemonicChecked = new EnglishMnemonic(mnemonics);
    await keys.writeKeysDataToFile(name, {
      mnemonics: mnemonicChecked.toString(),
      name,
    });
    log.info(`Keys recovered successfully for ${name}`);
  } catch (error) {
    log.error(`Failed to recover keys for ${name}:`, error);
    throw error;
  }
}

async function listAll(): Promise<void> {
  try {
    await keys.loadKeys();
    const keyList = keys.getAllKeys();
    if (Object.keys(keyList).length === 0) {
      log.info("No keys found.");
      return;
    }
    
    Object.keys(keyList).forEach((key) => {
      const networks = config.getNetworksByWalletName(key);
      console.log(`Key: ${key}\tNetworks: ${networks.join(', ')}`);
    });
  } catch (error) {
    log.error("Failed to list keys:", error);
    throw error;
  }
}

async function showKeys(name: string): Promise<void> {
  try {
    await keys.loadKeys()
    const networks = config.getNetworksByWalletName(name);
    const mnemonics = await keys.findKeyByName(name);
    
    if (!mnemonics) {
      throw new Error(`No key found with name: ${name}`);
    }

    for (const networkName of networks) {
      const network = config.getChainNetInfoByName(networkName);
      if (!network) {
        log.warn(`Network configuration not found for: ${networkName}`);
        continue;
      }

      const wallet = await keys.convertMnemonicsToKey(mnemonics, network.hd_path, network.prefix);
      const accounts = await wallet.getAccounts();
      if (accounts.length > 0) {
        console.log(`   => Network: ${networkName}, Address: ${accounts[0].address}`);
      } else {
        log.warn(`No accounts found for network: ${networkName}`);
      }
    }
  } catch (error) {
    log.error(`Failed to show keys for ${name}:`, error);
    throw error;
  }
}

async function deleteKeys(name: string): Promise<void> {
  try {
    const confirmDelete = await confirm({
      message: `Are you sure you want to delete keys for ${name}?`,
    });

    if (!confirmDelete) {
      log.info("Deletion cancelled.");
      return;
    }

    const isDeleted = await keys.deleteKey(name);
    if (isDeleted) {
      log.info(`Keys deleted successfully for ${name}`);
    } else {
      throw new Error(`Unable to delete keys for ${name}`);
    }
  } catch (error) {
    log.error(`Failed to delete keys for ${name}:`, error);
    throw error;
  }
}

export {
  addKeys,
  recoverKeys,
  listAll,
  showKeys,
  deleteKeys,
};