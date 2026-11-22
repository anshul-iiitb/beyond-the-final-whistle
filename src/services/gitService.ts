import { Message, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const BACKUP_FILE = path.join(process.cwd(), '.btfw_last_commit');
const MASTER_ADMIN = '478599245276905495';

async function runCmd(cmd: string, cwd = process.cwd()): Promise<{ stdout: string; stderr: string }> {
  return await execAsync(cmd, { cwd });
}

export async function handleBTFWGitPull(message: Message, args: string[]) {
  if (message.author.id !== MASTER_ADMIN && !process.env.OWNER_ID?.includes(message.author.id)) {
    return await message.reply('❌ Unauthorized: Only the Bot Owner can trigger git updates.');
  }

  const statusMsg = await message.reply('🔄 **[Beyond The Final Whistle] Initiating Git Pull & Build Verification...**');

  let previousCommit = '';
  try {
    const { stdout: headSha } = await runCmd('git rev-parse HEAD');
    previousCommit = headSha.trim();
    fs.writeFileSync(BACKUP_FILE, previousCommit, 'utf8');

    const targetBranch = args[0] || 'main';
    await runCmd('git stash').catch(() => {});
    const { stdout: pullOut } = await runCmd(`git pull origin ${targetBranch}`);

    const { stdout: currentCommit } = await runCmd('git rev-parse --short HEAD');
    const { stdout: commitMessage } = await runCmd('git log -1 --pretty=%B');

    if (pullOut.includes('Already up to date.') && !args.includes('--force')) {
      return await statusMsg.edit(`✅ **Beyond The Final Whistle is already up to date** at commit \`${currentCommit.trim()}\`.`);
    }

    await statusMsg.edit(`📥 **Pulled commit \`${currentCommit.trim()}\`**: *"${commitMessage.trim()}"*\n⚙️ **Validating Prisma types & TypeScript build...**`);

    try {
      const projectDir = fs.existsSync(path.join(process.cwd(), 'package.json')) ? process.cwd() : path.join(process.cwd(), 'beyond-the-final-whistle');
      await runCmd('npx prisma generate', projectDir);
      await runCmd('npx tsc', projectDir);
    } catch (buildError: any) {
      const errorOutput = buildError.stderr || buildError.stdout || buildError.message || 'Build Error';
      await runCmd(`git reset --hard ${previousCommit}`);

      const failEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🚨 Build Verification Failed — Auto-Rolled Back!')
        .setDescription(
          `Compilation failed on commit \`${currentCommit.trim()}\`.\n\n` +
          `**Safety Action**: Restored to **\`${previousCommit.slice(0, 7)}\`**.\n` +
          `\`\`\`ts\n${errorOutput.slice(0, 1000)}\n\`\`\``
        )
        .setTimestamp();

      return await statusMsg.edit({ content: '', embeds: [failEmbed] });
    }

    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🚀 Beyond The Final Whistle Updated & Verified!')
      .addFields(
        { name: 'Previous Commit', value: `\`${previousCommit.slice(0, 7)}\``, inline: true },
        { name: 'Active Commit', value: `\`${currentCommit.trim()}\``, inline: true },
        { name: 'Message', value: `*${commitMessage.trim()}*` }
      )
      .setFooter({ text: 'Restarting process...' })
      .setTimestamp();

    await statusMsg.edit({ content: '', embeds: [successEmbed] });

    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (err: any) {
    if (previousCommit) {
      await runCmd(`git reset --hard ${previousCommit}`).catch(() => {});
    }
    await statusMsg.edit(`❌ **Fatal Git Error:** \`\`\`${err.message}\`\`\``);
  }
}

export async function handleBTFWGitPullBack(message: Message) {
  if (message.author.id !== MASTER_ADMIN && !process.env.OWNER_ID?.includes(message.author.id)) {
    return await message.reply('❌ Unauthorized: Only the Bot Owner can trigger rollback.');
  }

  const statusMsg = await message.reply('⏪ **[Beyond The Final Whistle] Executing emergency rollback...**');

  try {
    let targetSha = '';
    if (fs.existsSync(BACKUP_FILE)) {
      targetSha = fs.readFileSync(BACKUP_FILE, 'utf8').trim();
    }
    const { stdout: headSha } = await runCmd('git rev-parse HEAD');
    const currentSha = headSha.trim();

    if (!targetSha || targetSha === currentSha) {
      const { stdout: prevSha } = await runCmd('git rev-parse HEAD~1');
      targetSha = prevSha.trim();
    }

    const projectDir = fs.existsSync(path.join(process.cwd(), 'package.json')) ? process.cwd() : path.join(process.cwd(), 'beyond-the-final-whistle');
    await runCmd(`git reset --hard ${targetSha}`);
    await runCmd('npx prisma generate', projectDir);
    await runCmd('npx tsc', projectDir);

    const { stdout: rolledCommit } = await runCmd('git rev-parse --short HEAD');
    const rollbackEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('⏪ Rollback Successful')
      .setDescription(`Restored to commit \`${rolledCommit.trim()}\`. Restarting...`)
      .setTimestamp();

    await statusMsg.edit({ content: '', embeds: [rollbackEmbed] });

    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (err: any) {
    await statusMsg.edit(`❌ **Rollback Error:** \`\`\`${err.message}\`\`\``);
  }
}
