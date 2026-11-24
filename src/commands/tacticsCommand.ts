import { 
  Message, 
  ContainerBuilder, 
  TextDisplayBuilder, 
  SeparatorBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags,
  Guild
} from 'discord.js';
import { prisma } from '../database/prisma.js';

export interface TeamTactics {
  // Attack Tactics
  teamMentality: 'Hard Defending' | 'Defensive' | 'Normal' | 'Attacking' | 'Hard Attacking';
  focusPassing: 'Mixed' | 'Down Both Flanks' | 'Right Flank' | 'Left Flank' | 'Through The Middle';
  passingStyle: 'Short' | 'Mixed' | 'Long';
  forceCounter: 'Off' | 'On';

  // Defence Tactics
  pressingStyle: 'Low' | 'High';
  tacklingStyle: 'Easy' | 'Normal' | 'Hard';
  markingStyle: 'Zonal' | 'Man-To-Man';
  offsideTrap: 'Off' | 'On';
}

export const DEFAULT_TACTICS: TeamTactics = {
  teamMentality: 'Attacking',
  focusPassing: 'Through The Middle',
  passingStyle: 'Long',
  forceCounter: 'On',
  pressingStyle: 'High',
  tacklingStyle: 'Hard',
  markingStyle: 'Man-To-Man',
  offsideTrap: 'On'
};

export function parseTeamTactics(rawTactics?: string | null): TeamTactics {
  if (!rawTactics) return { ...DEFAULT_TACTICS };
  try {
    const parsed = JSON.parse(rawTactics);
    return { ...DEFAULT_TACTICS, ...parsed };
  } catch {
    return { ...DEFAULT_TACTICS };
  }
}

export function serializeTeamTactics(tactics: TeamTactics): string {
  return JSON.stringify(tactics);
}

export function buildTacticsContainer(
  teamType: 'nation' | 'club',
  teamId: string,
  teamName: string,
  page: 'attack' | 'defence',
  tactics: TeamTactics
): ContainerBuilder {
  const container = new ContainerBuilder();

  if (page === 'attack') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ⚔️ ${teamName} — Attack Tactics`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    );

    // 1. Team Mentality
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Team mentality**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_mentality_${teamType}_${teamId}`)
          .setPlaceholder('Select team mentality...')
          .addOptions([
            { label: 'Hard Defending', value: 'Hard Defending', default: tactics.teamMentality === 'Hard Defending' },
            { label: 'Defensive', value: 'Defensive', default: tactics.teamMentality === 'Defensive' },
            { label: 'Normal', value: 'Normal', default: tactics.teamMentality === 'Normal' },
            { label: 'Attacking', value: 'Attacking', default: tactics.teamMentality === 'Attacking' },
            { label: 'Hard Attacking', value: 'Hard Attacking', default: tactics.teamMentality === 'Hard Attacking' }
          ])
      )
    );

    // 2. Focus Passing
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Focus passing**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_focus_${teamType}_${teamId}`)
          .setPlaceholder('Select focus passing...')
          .addOptions([
            { label: 'Mixed', value: 'Mixed', default: tactics.focusPassing === 'Mixed' },
            { label: 'Down Both Flanks', value: 'Down Both Flanks', default: tactics.focusPassing === 'Down Both Flanks' },
            { label: 'Right Flank', value: 'Right Flank', default: tactics.focusPassing === 'Right Flank' },
            { label: 'Left Flank', value: 'Left Flank', default: tactics.focusPassing === 'Left Flank' },
            { label: 'Through The Middle', value: 'Through The Middle', default: tactics.focusPassing === 'Through The Middle' }
          ])
      )
    );

    // 3. Passing Style
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Passing style**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_passing_${teamType}_${teamId}`)
          .setPlaceholder('Select passing style...')
          .addOptions([
            { label: 'Short', value: 'Short', default: tactics.passingStyle === 'Short' },
            { label: 'Mixed', value: 'Mixed', default: tactics.passingStyle === 'Mixed' },
            { label: 'Long', value: 'Long', default: tactics.passingStyle === 'Long' }
          ])
      )
    );

    // 4. Force Counter-Attacks
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Force counter-attacks**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_counter_${teamType}_${teamId}`)
          .setPlaceholder('Select counter-attack setting...')
          .addOptions([
            { label: 'Off', value: 'Off', default: tactics.forceCounter === 'Off' },
            { label: 'On', value: 'On', default: tactics.forceCounter === 'On' }
          ])
      )
    );

    // Navigation Button: Defence ▶
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`tactics_page_defence_${teamType}_${teamId}`)
          .setLabel('Defence ▶')
          .setStyle(ButtonStyle.Secondary)
      )
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Use the dropdowns above to change a setting.')
    );
  } else {
    // Defence Tactics
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🛡️ ${teamName} — Defence Tactics`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    );

    // 1. Pressing Style
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Pressing style**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_pressing_${teamType}_${teamId}`)
          .setPlaceholder('Select pressing style...')
          .addOptions([
            { label: 'Low', value: 'Low', default: tactics.pressingStyle === 'Low' },
            { label: 'High', value: 'High', default: tactics.pressingStyle === 'High' }
          ])
      )
    );

    // 2. Tackling Style
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Tackling style**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_tackling_${teamType}_${teamId}`)
          .setPlaceholder('Select tackling style...')
          .addOptions([
            { label: 'Easy', value: 'Easy', default: tactics.tacklingStyle === 'Easy' },
            { label: 'Normal', value: 'Normal', default: tactics.tacklingStyle === 'Normal' },
            { label: 'Hard', value: 'Hard', default: tactics.tacklingStyle === 'Hard' }
          ])
      )
    );

    // 3. Marking Style
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Marking style**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_marking_${teamType}_${teamId}`)
          .setPlaceholder('Select marking style...')
          .addOptions([
            { label: 'Zonal', value: 'Zonal', default: tactics.markingStyle === 'Zonal' },
            { label: 'Man-To-Man', value: 'Man-To-Man', default: tactics.markingStyle === 'Man-To-Man' }
          ])
      )
    );

    // 4. Play Offside Trap
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Play offside trap**')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`tactics_offside_${teamType}_${teamId}`)
          .setPlaceholder('Select offside trap setting...')
          .addOptions([
            { label: 'Off', value: 'Off', default: tactics.offsideTrap === 'Off' },
            { label: 'On', value: 'On', default: tactics.offsideTrap === 'On' }
          ])
      )
    );

    // Navigation Button: ◀ Attack
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`tactics_page_attack_${teamType}_${teamId}`)
          .setLabel('◀ Attack')
          .setStyle(ButtonStyle.Secondary)
      )
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Use the dropdowns above to change a setting.')
    );
  }

  return container;
}

/**
 * Handles the -tactics command
 */
export async function handleTacticsCommand(message: Message, args: string[]) {
  const channelName = 'name' in message.channel ? (message.channel as any).name?.toLowerCase() || '' : '';
  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true, club: true }
  });

  // Check if channel belongs to a specific national team (e.g. netherlands, germany, etc.)
  let targetNation = null;
  if (channelName) {
    const allNations = await prisma.nationalTeam.findMany();
    for (const n of allNations) {
      if (channelName.includes(n.alias.toLowerCase()) || channelName.includes(n.name.toLowerCase())) {
        targetNation = n;
        break;
      }
    }
  }

  // If not in a nation channel, use player's registered national team or specified arg
  if (!targetNation && args[0]) {
    const aliasArg = args[0].toLowerCase();
    targetNation = await prisma.nationalTeam.findFirst({
      where: {
        OR: [
          { alias: aliasArg },
          { name: { equals: aliasArg, mode: 'insensitive' } }
        ]
      }
    });
  }

  if (!targetNation && player?.nation) {
    targetNation = player.nation;
  }

  if (!targetNation) {
    return await message.reply(
      '❌ Please join a national team first using `-joinnation <alias>`, run `-tactics` inside your national team locker room channel, or specify a nation (e.g. `-tactics ned`).'
    );
  }

  const tactics = parseTeamTactics(targetNation.tactics);
  const container = buildTacticsContainer(
    'nation',
    targetNation.id,
    targetNation.name,
    'attack',
    tactics
  );

  await (message.channel as any).send({
    flags: MessageFlags.IsComponentsV2,
    components: [container]
  });
}
