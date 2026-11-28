import { Message } from 'discord.js';
import { handleProfileCommand, handleSetDescCommand, handleLeaderboardCommand, handleGiveCommand, handleJoinNationCommand, handleDailyCommand } from '../commands/playerCommands.js';
import { handlePlaystyleCommand } from '../commands/playstyleCommand.js';
import { handleCooldownCommand } from '../commands/cooldownCommand.js';
import { handleTravelCommand, handleLocationsCommand, handleShowroomCommand, handleVehicleBuyCommand } from '../commands/travelCommands.js';
import { handleTrainCommand, handleSpTrainCommand, handleRecoveryCommand, handleConvertCommand } from '../commands/trainingCommands.js';
import { handleAdvertCommand, handleCoachingCommand, handleMeetGreetCommand, handleChirpCommand } from '../commands/socialCommands.js';
import { handleBuyCommand, handleUseCommand, handleIntelCommand } from '../commands/marketCommands.js';
import { handleIntTeamCommand, handleIntSetCommand } from '../commands/intTeamCommand.js';
import { handleAvatarCommand, handleAvatarBuyCommand, handleAvatarClaimCommand, handleEquipCommand, handleThemeCommand, handleInventoryCommand } from '../commands/cosmeticCommands.js';
import {
  handleAuctionHouseCommand,
  handleBidCommand,
  handleSeedAuctionCommand,
  handleAuctionStartCommand,
  handleAuctionConfigCommand,
  handleAuctionEndCommand,
  handleAuctionCancelCommand,
  handleAuctionHaltCommand,
  handleAuctionResumeCommand
} from '../commands/auctionCommands.js';
import { handleMatchCommand, handleFriendlyCommand, handleLiveMatchCommand, handleBatchMatchCommand, handleIntStatsCommand, handleClubStatsCommand, handleRosterCommand, handleTestMatchCommand } from '../commands/matchCommands.js';
import { handleTacticsCommand } from '../commands/tacticsCommand.js';
import { handleBetCommand, handleOddsCommand, handleFixturesCommand, handleMyBetsCommand, handleFixtureAdminCommand } from '../commands/bettingCommands.js';
import { handlePotwCommand } from '../commands/potwCommand.js';
import { handleStadiumCommand } from '../commands/stadiumCommand.js';
import {
  handleSetupCommand,
  handleVipCommand,
  handleDevFundCommand,
  handleAddItemCommand,
  handleAddVarCommand,
  handleSetupEmojisCommand,
  handlePricesCommand,
  handleSetPriceCommand
} from '../commands/adminCommands.js';
import { handleHelpCommand } from '../commands/helpCommand.js';
import { handleBTFWGitPull, handleBTFWGitPullBack } from '../services/gitService.js';
import { validateCommandAccess } from '../engines/campusEngine.js';
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
    const access = await validateCommandAccess({
      cmd,
      userId: message.author.id,
      guild: message.guild,
      channelId: message.channelId
    });
    if (!access.allowed && access.message) {
      await message.reply(access.message);
      return;
    }

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
      case 'daily':
        await handleDailyCommand(message);
        break;
      case 'cd':
      case 'cooldown':
      case 'cooldowns':
        await handleCooldownCommand(message);
        break;
      case 'playstyle':
      case 'setplaystyle':
      case 'pickplaystyle':
      case 'chooseplaystyle':
      case 'styles':
      case 'roles':
        await handlePlaystyleCommand(message, args);
        break;
      case 'joinnation':
      case 'nation':
        await handleJoinNationCommand(message, args);
        break;
      case 'intteam':
      case 'team':
        await handleIntTeamCommand(message, args);
        break;
      case 'intset':
        await handleIntSetCommand(message, args);
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
        await handleShowroomCommand(message, args);
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
      case 'use':
        await handleUseCommand(message, args);
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

      // Cosmetics, Studio Themes & Auction House
      case 'avatar':
      case 'avatars':
      case 'boutique':
        await handleAvatarCommand(message, args);
        break;
      case 'avatarbuy':
        await handleAvatarBuyCommand(message, args);
        break;
      case 'avatarclaim':
        await handleAvatarClaimCommand(message, args);
        break;
      case 'equip':
        await handleEquipCommand(message, args);
        break;
      case 'inv':
      case 'inventory':
      case 'locker':
      case 'bag':
        await handleInventoryCommand(message, args);
        break;
      case 'theme':
      case 'themes':
        await handleThemeCommand(message, args);
        break;
      case 'ah':
      case 'auction':
      case 'auctions':
        await handleAuctionHouseCommand(message);
        break;
      case 'bid':
        await handleBidCommand(message, args);
        break;

      // Match Simulation & Statistics
      case 'match':
      case 'play':
        await handleMatchCommand(message, args);
        break;
      case 'friendly':
      case 'exhibition':
        await handleFriendlyCommand(message, args);
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
      case 'testmatch':
      case 'simtest':
        await handleTestMatchCommand(message, args);
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

      // Sportsbook & Fixtures
      case 'bet':
        await handleBetCommand(message, args);
        break;
      case 'odds':
        await handleOddsCommand(message, args);
        break;
      case 'fixtures':
      case 'schedule':
        await handleFixturesCommand(message, args);
        break;
      case 'bets':
      case 'slips':
        await handleMyBetsCommand(message);
        break;
      case 'fixture':
        await handleFixtureAdminCommand(message, args);
        break;

      // Player of the Week & Stadiums
      case 'potw':
      case 'form':
        await handlePotwCommand(message);
        break;
      case 'stadium':
      case 'arena':
        await handleStadiumCommand(message, args);
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
      case 'devfund':
        await handleDevFundCommand(message, args);
        break;
      case 'seedauction':
        await handleSeedAuctionCommand(message, args);
        break;
      case 'auctionstart':
      case 'ahstart':
      case 'createauction':
        await handleAuctionStartCommand(message, args);
        break;
      case 'auctionconfig':
      case 'ahconfig':
        await handleAuctionConfigCommand(message, args);
        break;
      case 'auctionend':
      case 'ahend':
        await handleAuctionEndCommand(message, args);
        break;
      case 'auctioncancel':
      case 'ahcancel':
        await handleAuctionCancelCommand(message, args);
        break;
      case 'auctionhalt':
      case 'ahhalt':
      case 'haltauction':
      case 'auctionpause':
      case 'ahpause':
      case 'pauseauction':
        await handleAuctionHaltCommand(message, args);
        break;
      case 'auctionresume':
      case 'ahresume':
      case 'resumeauction':
      case 'auctionunpause':
      case 'ahunpause':
        await handleAuctionResumeCommand(message, args);
        break;
      case 'prices':
        await handlePricesCommand(message);
        break;
      case 'setprice':
      case 'setprices':
        await handleSetPriceCommand(message, args);
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
