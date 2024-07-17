import { Command } from "commander";
import info from "../../package.json";
import { runCommand } from "./handler";
import { initCommand } from "./commands/init";
import {
  addKeys,
  deleteKeys,
  listAll,
  recoverKeys,
  showKeys,
} from "./commands/keys";
import logger from "../utils/log";
import startBot from "./commands/start";

const log = logger("cli:index");

export function setupCLI(): Command {
  const program = new Command();

  program
    .name(info.name)
    .description(info.description)
    .version(info.version)
    .allowUnknownOption(false)
    .showHelpAfterError(true);

  program
    .command("init")
    .description(`Initialize configuration for ${info.name}`)
    .action(runCommand(initCommand));

  program
    .command("start")
    .description("Start bot application")
    .action(runCommand(startBot));

  const keysCommand = program
    .command("keys")
    .description("Commands to manage keys");

  keysCommand
    .command("add <walletName>")
    .description("Add a new wallet")
    .option("-r, --recover", "Recover wallet from mnemonic")
    .action((walletName: string, options: { recover?: boolean }) => {
      log.debug(`Adding the wallet key: ${walletName}`);
      if (options.recover) {
        runCommand(recoverKeys)(walletName);
      } else {
        runCommand(addKeys)(walletName);
      }
    });

  keysCommand
    .command("delete <walletName>")
    .description("Delete the specified wallet")
    .action(runCommand(deleteKeys));

  keysCommand
    .command("list")
    .description("List all wallets")
    .action(runCommand(listAll));

  keysCommand
    .command("show <walletName>")
    .description("Show details of the specified wallet")
    .action(runCommand(showKeys));

  program.on("command:*", (operands: string[]) => {
    log.error(`Error: Unknown command '${operands[0]}'`);
    const availableCommands = program.commands.map((cmd) => cmd.name());
    log.info(`Available commands: ${availableCommands.join(", ")}`);
    log.info("For more information, use the --help option with a command");
    process.exit(1);
  });

  return program;
}


const program = setupCLI();
program.parse(process.argv);


