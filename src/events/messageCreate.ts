import { Message } from 'discord.js';
import { handleProfileCommand, handleSetDescCommand, handleLeaderboardCommand, handleGiveCommand, handleJoinNationCommand } from '../commands/playerCommands.js';
import { handleTravelCommand, handleLocationsCommand, handleShowroomCommand, handleVehicleBuyCommand } from '../commands/travelCommands.js';
import { handleTrainCommand, handleSpTrainCommand, handleRecoveryCommand, handleConvertCommand } from '../commands/trainingCommands.js';
import { handleAdvertCommand, handleCoachingCommand, handleMeetGreetCommand, handleChirpCommand } from '../commands/socialCommands.js';
import { handleBuyCommand, handleIntelCommand } from '../commands/marketCommands.js';
import { handleMatchCommand, handleLiveMatchCommand, handleBatchMatchCommand, handleIntStatsCommand, handleClubStatsCommand, handleRosterCommand } from '../commands/matchCommands.js';
import { handleTacticsCommand } from '../commands/tacticsCommand.js';
import { handleSetupCommand, handleVipCommand, handleAddItemCommand, handleAddVarCommand, handleSetupEmojisCommand } from '../commands/adminCommands.js';
import { handleHelpCommand } from '../commands/helpCommand.js';
import { handleBTFWGitPull, handleBTFWGitPullBack } from '../services/gitService.js';
import { logger } from '../utils/logger.js';

const PREFIX = '-';

export async function onMessageCreate(message: Message) {
  if (message.author.bot) return;

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  try {
    switch (cmd) {
      // Profile & Reputation
      case 'profile':
      case 'p':
        await handleProfileCommand(message, args);
        break;
      case 'setdesc':
      case 'bio':
        await handleSetDescCommand(message, args);
        break;
      case 'lb':
      case 'leaderboard':
        await handleLeaderboardCommand(message, args);
        break;
      case 'give':
      case 'pay':
        await handleGiveCommand(message, args);
        break;
      case 'joinnation':
      case 'nation':
        await handleJoinNationCommand(message, args);
        break;

      // Spatial Campus & Showroom
      case 'locations':
      case 'locs':
        await handleLocationsCommand(message);
        break;
      case 'travel':
      case 't':
        await handleTravelCommand(message, args);
        break;
      case 'showroom':
      case 'dealership':
      case 'vs':
        await handleShowroomCommand(message);
        break;
      case 'vehiclebuy':
      case 'buycar':
        await handleVehicleBuyCommand(message, args);
        break;

      // Training & Biomechanics Lab
      case 'train':
        await handleTrainCommand(message, args);
        break;
      case 'sptrain':
      case 'upgrade':
        await handleSpTrainCommand(message, args);
        break;
      case 'convert':
        await handleConvertCommand(message, args);
        break;
      case 'recovery':
      case 'sauna':
        await handleRecoveryCommand(message);
        break;

      // Market & Tactical Scouting
      case 'buy':
      case 'shop':
      case 'gm':
      case 'market':
        await handleBuyCommand(message, args);
        break;
      case 'intel':
      case 'scout':
        await handleIntelCommand(message);
        break;

      // Socials & Sponsorships
      case 'advert':
      case 'sponsor':
        await handleAdvertCommand(message, args);
        break;
      case 'coaching':
      case 'coach':
        await handleCoachingCommand(message);
        break;
      case 'meetgreet':
      case 'mg':
        await handleMeetGreetCommand(message);
        break;
      case 'chirp':
      case 'tweet':
        await handleChirpCommand(message, args);
        break;

      // Match Simulation & Statistics
      case 'match':
      case 'play':
        await handleMatchCommand(message, args);
        break;
      case 'livematch':
      case 'simlive':
      case 'live':
        await handleLiveMatchCommand(message, args);
        break;
      case 'batchmatch':
      case 'batchsim':
      case 'simulatemany':
        await handleBatchMatchCommand(message, args);
        break;
      case 'intstats':
        await handleIntStatsCommand(message, args);
        break;
      case 'clubstats':
        await handleClubStatsCommand(message, args);
        break;
      case 'roster':
        await handleRosterCommand(message, args);
        break;
      case 'tactics':
      case 'tactic':
        await handleTacticsCommand(message, args);
        break;

      // Admin & Server Setup
      case 'setup':
      case 'setupcampus':
        await handleSetupCommand(message);
        break;
      case 'setupemojis':
      case 'emojis':
        await handleSetupEmojisCommand(message);
        break;
      case 'vip':
        await handleVipCommand(message, args);
        break;
      case 'additem':
        await handleAddItemCommand(message, args);
        break;
      case 'addvar':
        await handleAddVarCommand(message, args);
        break;

      // DevOps Hot-Reload
      case 'gitpull':
      case 'pull':
        await handleBTFWGitPull(message, args);
        break;
      case 'gitpullback':
      case 'rollback':
        await handleBTFWGitPullBack(message);
        break;

      // Help
      case 'help':
      case 'commands':
      case 'guide':
        await handleHelpCommand(message);
        break;

      default:
        break;
    }
  } catch (error) {
    logger.error({ error, cmd }, 'Error executing Beyond The Final Whistle command');
    await message.reply('❌ An unexpected error occurred while executing this command.').catch(() => {});
  }
}
