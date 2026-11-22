import { Message } from 'discord.js';
import { executeTraining, upgradeAttribute, convertPlaystyle, executeSaunaRecovery } from '../engines/trainingEngine.js';

export async function handleTrainCommand(message: Message, args: string[]) {
  const modeArg = args[0]?.toLowerCase();
  let type: 'normal' | 'vip' | 'noeffort' = 'normal';

  if (modeArg === 'vip') {
    type = 'vip';
  } else if (modeArg === 'noeffort' || modeArg === 'lazy') {
    type = 'noeffort';
  }

  const result = await executeTraining(message.author.id, type);
  await message.reply(result.message);
}

export async function handleSpTrainCommand(message: Message, args: string[]) {
  const attrArg = args[0];
  if (!attrArg) {
    return await message.reply(
      '❌ Please specify an attribute to develop. Example: `-sptrain fin` or `-upgrade pac`\n' +
      '**Attributes:** `fin`, `pow`, `hea`, `pas`, `vis`, `cro`, `dri`, `tck`, `int`, `mrk`, `pac`, `phy`, `cmp`, `agi`, `wrk`'
    );
  }

  const result = await upgradeAttribute(message.author.id, attrArg);
  await message.reply(result.message);
}

export async function handleConvertCommand(message: Message, args: string[]) {
  const styleArg = args[0];
  if (!styleArg) {
    return await message.reply(
      '❌ Please specify a playstyle. Example: `-convert pch`\n' +
      '**Playstyles:** `PCH` (Poacher), `SPD` (Speedster), `TGT` (Target Man), `PLM` (Playmaker), `B2B` (Box-to-Box), `ANC` (Anchor), `STP` (Stopper), `SWP` (Sweeper), `BPD` (Ball-Playing Defender)'
    );
  }

  const result = await convertPlaystyle(message.author.id, styleArg);
  await message.reply(result.message);
}

export async function handleRecoveryCommand(message: Message) {
  const result = await executeSaunaRecovery(message.author.id);
  await message.reply(result.message);
}
