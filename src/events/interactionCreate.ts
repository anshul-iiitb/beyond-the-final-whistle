import { Interaction, ButtonInteraction, StringSelectMenuInteraction, TextChannel, MessageFlags, EmbedBuilder } from 'discord.js';
import { executeTraining, upgradeAttribute } from '../engines/trainingEngine.js';
import { buildTrainingSuccessEmbed, buildSpTrainLabPayload } from '../commands/trainingCommands.js';
import { executeSponsorAdvert, applyTweetVote, buildUpdatedTweetEmbed } from '../engines/socialEngine.js';
import { prisma } from '../database/prisma.js';
import {
  buildProfileViewPayload,
  buildLeaderboardPayload,
  normalizeLeaderboardCategory
} from '../commands/playerCommands.js';
import { buildShowroomPayload } from '../commands/travelCommands.js';
import { buildCosmeticShopPayload } from '../commands/cosmeticCommands.js';
import { buildAuctionHousePayload } from '../commands/auctionCommands.js';
import { buildTacticsContainer, parseTeamTactics, serializeTeamTactics, TeamTactics } from '../commands/tacticsCommand.js';
import { formatK } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { validateCommandAccess } from '../engines/campusEngine.js';

const INTERACTION_CMD_PREFIX_MAP: Array<{ prefix: string; exact?: boolean; cmd: string }> = [
  { prefix: 'sptrain_select_', cmd: 'sptrain' },
  { prefix: 'train_', cmd: 'train' },
  { prefix: 'showroom_page_', cmd: 'showroom' },
  { prefix: 'avatar_page_', cmd: 'avatar' },
  { prefix: 'ah_refresh', exact: true, cmd: 'ah' },
  { prefix: 'sponsor_', cmd: 'advert' }
];

export async function onInteractionCreate(interaction: Interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  try {
    const customId = interaction.customId;

    const matchedRule = INTERACTION_CMD_PREFIX_MAP.find(r =>
      r.exact ? customId === r.prefix : customId.startsWith(r.prefix)
    );
    if (matchedRule) {
      const access = await validateCommandAccess({
        cmd: matchedRule.cmd,
        userId: interaction.user.id,
        guild: interaction.guild,
        channelId: interaction.channelId
      });
      if (!access.allowed && access.message) {
        return await interaction.reply({ content: access.message, ephemeral: true });
      }
    }

    // ==========================================
    // TACTICS SYSTEM (COMPONENTS V2)
    // ==========================================

    // A. Page Toggle Button: tactics_page_defence_nation_<id> or tactics_page_attack_nation_<id>
    if (interaction.isButton() && customId.startsWith('tactics_page_')) {
      const parts = customId.split('_'); // ['tactics', 'page', 'defence' | 'attack', 'nation' | 'club', teamId]
      const targetPage = parts[2] as 'defence' | 'attack';
      const teamType = parts[3] as 'nation' | 'club';
      const teamId = parts[4];

      let teamName = 'National Team';
      let rawTactics: string | null = null;

      if (teamType === 'nation') {
        const nation = await prisma.nationalTeam.findUnique({ where: { id: teamId } });
        if (nation) {
          teamName = nation.name;
          rawTactics = nation.tactics;
        }
      } else {
        const club = await prisma.footballClub.findUnique({ where: { id: teamId } });
        if (club) {
          teamName = club.name;
          rawTactics = club.tactics;
        }
      }

      const tactics = parseTeamTactics(rawTactics);
      const container = buildTacticsContainer(teamType, teamId, teamName, targetPage, tactics);

      return await (interaction as any).update({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
      });
    }

    // B. Tactics Select Menus: tactics_<setting>_<teamType>_<teamId>
    if (interaction.isStringSelectMenu() && customId.startsWith('tactics_')) {
      const parts = customId.split('_'); // ['tactics', 'mentality' | 'focus' | 'passing' | 'counter' | 'pressing' | 'tackling' | 'marking' | 'offside', teamType, teamId]
      const setting = parts[1];
      const teamType = parts[2] as 'nation' | 'club';
      const teamId = parts[3];
      const selectedValue = interaction.values[0];

      let teamName = 'National Team';
      let rawTactics: string | null = null;

      if (teamType === 'nation') {
        const nation = await prisma.nationalTeam.findUnique({ where: { id: teamId } });
        if (nation) {
          teamName = nation.name;
          rawTactics = nation.tactics;
        }
      } else {
        const club = await prisma.footballClub.findUnique({ where: { id: teamId } });
        if (club) {
          teamName = club.name;
          rawTactics = club.tactics;
        }
      }

      const tactics = parseTeamTactics(rawTactics);

      // Mutate the specific tactical setting
      let currentPage: 'attack' | 'defence' = 'attack';
      switch (setting) {
        case 'mentality':
          tactics.teamMentality = selectedValue as TeamTactics['teamMentality'];
          currentPage = 'attack';
          break;
        case 'focus':
          tactics.focusPassing = selectedValue as TeamTactics['focusPassing'];
          currentPage = 'attack';
          break;
        case 'passing':
          tactics.passingStyle = selectedValue as TeamTactics['passingStyle'];
          currentPage = 'attack';
          break;
        case 'counter':
          tactics.forceCounter = selectedValue as TeamTactics['forceCounter'];
          currentPage = 'attack';
          break;
        case 'pressing':
          tactics.pressingStyle = selectedValue as TeamTactics['pressingStyle'];
          currentPage = 'defence';
          break;
        case 'tackling':
          tactics.tacklingStyle = selectedValue as TeamTactics['tacklingStyle'];
          currentPage = 'defence';
          break;
        case 'marking':
          tactics.markingStyle = selectedValue as TeamTactics['markingStyle'];
          currentPage = 'defence';
          break;
        case 'offside':
          tactics.offsideTrap = selectedValue as TeamTactics['offsideTrap'];
          currentPage = 'defence';
          break;
      }

      // Persist to database
      const serialized = serializeTeamTactics(tactics);
      if (teamType === 'nation') {
        await prisma.nationalTeam.update({
          where: { id: teamId },
          data: { tactics: serialized }
        });
      } else {
        await prisma.footballClub.update({
          where: { id: teamId },
          data: { tactics: serialized }
        });
      }

      const container = buildTacticsContainer(teamType, teamId, teamName, currentPage, tactics);
      return await (interaction as any).update({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
      });
    }

    // C. Research Lab Attribute Upgrade Select Menu: sptrain_select_<userId>
    if (interaction.isStringSelectMenu() && customId.startsWith('sptrain_select_')) {
      const ownerId = customId.replace('sptrain_select_', '');
      if (interaction.user.id !== ownerId) {
        return await interaction.reply({
          content: '❌ This Research Lab menu belongs to another player. Run `-sptrain` to open yours!',
          ephemeral: true
        });
      }

      await interaction.deferUpdate();
      const selectedAttr = interaction.values[0];
      const result = await upgradeAttribute(interaction.user.id, selectedAttr);
      const refreshed = await buildSpTrainLabPayload(interaction.user.id, interaction.user, interaction.guild);

      if (!refreshed) {
        return await interaction.editReply({ content: result.message, embeds: [], components: [], attachments: [] });
      }

      return await interaction.editReply({
        content: result.message,
        embeds: [refreshed.embed],
        components: refreshed.components,
        attachments: []
      });
    }

    // ==========================================
    // BUTTON INTERACTIONS
    // ==========================================
    if (!interaction.isButton()) return;

    // 1. Training Drills: train_normal, train_vip, train_noeffort
    if (customId.startsWith('train_')) {
      const type = customId.replace('train_', '') as 'normal' | 'vip' | 'noeffort';
      
      // Immediately acknowledge interaction to avoid 3s Discord timeout ("did not respond")
      await sendThinkingMessage(interaction, 'Recording pitch training session...');

      const result = await executeTraining(interaction.user.id, type);

      if (!result.success) {
        return await updateLoadingMessage(interaction, {
          content: result.error || result.message || '❌ Training failed.',
          embeds: [],
          files: []
        });
      }

      const output = buildTrainingSuccessEmbed(result, interaction.user, interaction.guild);
      return await updateLoadingMessage(interaction, { embeds: [output.embed], files: output.files });
    }

    // 2. Tweet Engagements: tweet_like_<id>, tweet_dislike_<id>
    if (customId.startsWith('tweet_like_') || customId.startsWith('tweet_dislike_')) {
      const isLike = customId.startsWith('tweet_like_');
      const tweetId = isLike ? customId.replace('tweet_like_', '') : customId.replace('tweet_dislike_', '');

      const voteResult = await applyTweetVote({ id: tweetId }, interaction.user.id, isLike, interaction.client);
      if (!voteResult.success) {
        return await interaction.reply({ content: voteResult.error || '❌ Unable to vote.', ephemeral: true });
      }

      const existingEmbed = interaction.message.embeds[0];
      if (existingEmbed) {
        const newEmbed = buildUpdatedTweetEmbed(existingEmbed, voteResult);
        await interaction.message.edit({ embeds: [newEmbed] }).catch(() => {});
      }

      const coinRewardNote =
        voteResult.reactorCoinsAwarded && voteResult.reactorCoinsAwarded > 0n
          ? ` You earned **+${formatK(voteResult.reactorCoinsAwarded)} coins**!`
          : ' Register with `-profile` to earn **+5k coins** per reaction!';

      return await interaction.reply({
        content:
          (isLike
            ? 'You liked the tweet! (+100k followers to author).'
            : 'You disliked the tweet! (-50k followers to author).') + coinRewardNote,
        ephemeral: true
      });
    }

    // 2b. Tweet Voters Inspection Button
    if (interaction.isButton() && customId.startsWith('tweet_voters_')) {
      const tweetId = customId.replace('tweet_voters_', '');
      const votes = await prisma.playerTweetVote.findMany({
        where: { tweetId }
      });

      const upvoterTags = votes.filter(v => v.isLike).map(v => `<@${v.voterId}>`);
      const downvoterTags = votes.filter(v => !v.isLike).map(v => `<@${v.voterId}>`);

      const voterEmbed = new EmbedBuilder()
        .setColor('#1e293b')
        .setTitle('👥 Tweet Voter Telemetry')
        .setDescription(
          `### 👍 Upvoters (${upvoterTags.length})\n` +
          (upvoterTags.length > 0 ? upvoterTags.join(' ') : '*No upvotes yet.*') +
          `\n\n### 👎 Downvoters (${downvoterTags.length})\n` +
          (downvoterTags.length > 0 ? downvoterTags.join(' ') : '*No downvotes yet.*')
        )
        .setFooter({ text: 'Beyond The Final Whistle • Social Network' })
        .setTimestamp();

      return await interaction.reply({ embeds: [voterEmbed], ephemeral: true });
    }

    // 3. Profile Tabs: profile_main_<userId>, profile_stats_<userId>, profile_attr_<userId>
    if (customId.startsWith('profile_')) {
      await interaction.deferUpdate();
      const parts = customId.split('_'); // ['profile', 'main' | 'stats' | 'attr', userId]
      const tab = parts[1] as 'main' | 'stats' | 'attr';
      const targetUserId = parts[2];

      const player = await prisma.player.findUnique({
        where: { id: targetUserId },
        include: { vehicles: true, nation: true, club: true, inventory: true }
      });

      if (!player) {
        return await interaction.followUp({ content: '❌ Profile not found.', ephemeral: true });
      }

      const targetUser =
        interaction.client.users.cache.get(targetUserId) ||
        (await interaction.client.users.fetch(targetUserId).catch(() => interaction.user));
      const payload = await buildProfileViewPayload(player, targetUser, tab, interaction.guild);
      return await interaction.editReply({
        embeds: [payload.embed],
        components: payload.components,
        files: payload.files,
        attachments: []
      });
    }

    // 3b. Leaderboard Category Switcher: lb_ovr, lb_goals, lb_wealth, lb_followers
    if (customId.startsWith('lb_')) {
      await interaction.deferUpdate();
      const cat = normalizeLeaderboardCategory(customId.replace('lb_', ''));
      const payload = await buildLeaderboardPayload(cat, interaction.user.id, interaction.guild, interaction.client);
      return await interaction.editReply({
        embeds: [payload.embed],
        files: payload.files,
        components: payload.components,
        attachments: []
      });
    }

    // 3c. Showroom Tier Switcher: showroom_page_1, showroom_page_2, showroom_page_3
    if (customId.startsWith('showroom_page_')) {
      await interaction.deferUpdate();
      const page = parseInt(customId.replace('showroom_page_', ''), 10) || 1;
      const payload = await buildShowroomPayload(interaction.user.id, page, interaction.guild);
      return await interaction.editReply({
        embeds: [payload.embed],
        files: payload.files,
        components: payload.components,
        attachments: []
      });
    }

    // 3d. Cosmetic Boutique Page Switcher: avatar_page_1, avatar_page_2
    if (customId.startsWith('avatar_page_')) {
      await interaction.deferUpdate();
      const page = parseInt(customId.replace('avatar_page_', ''), 10) || 1;
      const payload = await buildCosmeticShopPayload(interaction.user.id, page, interaction.guild);
      return await interaction.editReply({
        embeds: [payload.embed],
        files: payload.files,
        components: payload.components,
        attachments: []
      });
    }

    // 3e. Auction House Live Refresh: ah_refresh
    if (customId === 'ah_refresh') {
      await interaction.deferUpdate();
      const payload = await buildAuctionHousePayload(interaction.user.id, interaction.client, interaction.guild);
      return await interaction.editReply({
        embeds: [payload.embed],
        files: payload.files,
        components: payload.components,
        attachments: []
      });
    }

    // 4. Commercial Sponsor Endorsements: sponsor_heineken, sponsor_adidas, etc.
    if (customId.startsWith('sponsor_')) {
      const sponsorKey = customId.replace('sponsor_', '');
      await sendThinkingMessage(interaction, 'Recording commercial photoshoot...');

      const result = await executeSponsorAdvert(interaction.user.id, sponsorKey, interaction.guild);

      if (!result.success) {
        return await updateLoadingMessage(interaction, { content: result.message, embeds: [], files: [] });
      }

      if (result.embed) {
        return await updateLoadingMessage(interaction, { embeds: [result.embed], files: result.files || [] });
      }

      return await updateLoadingMessage(interaction, { content: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Error in onInteractionCreate button handler');
    if (interaction.deferred && !interaction.replied) {
      await interaction.followUp({ content: '❌ An error occurred processing this action.', ephemeral: true }).catch(() => {});
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred processing this action.', ephemeral: true }).catch(() => {});
    }
  }
}
