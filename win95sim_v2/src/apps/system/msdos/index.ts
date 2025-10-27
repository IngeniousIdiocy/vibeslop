import { VfsNode, VfsService } from '@services/vfs';
import { dirname, normalizePath, parts } from '@services/vfs/utils/path';

export interface MsDosPromptDependencies {
  vfs: VfsService;
  onExit?: () => void;
}

export interface MsDosPromptInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
  focus(): void;
}

type CommandHandler = (args: string[], raw: string) => Promise<void> | void;

const INITIAL_BANNER = [
  'Microsoft(R) Windows 95',
  '(C)Copyright Microsoft Corp 1981-1995.',
  '',
];

const DEFAULT_VOLUME_LABEL = 'WIN95SIM';
const DEFAULT_VOLUME_SERIAL = '1A2B-3C4D';
const DEFAULT_PROMPT_TEMPLATE = '$p$g';
const DEFAULT_ENVIRONMENT: Array<[string, string]> = [
  ['COMSPEC', 'C\\WINDOWS\\COMMAND.COM'],
  ['PATH', 'C\\WINDOWS;C\\WINDOWS\\COMMAND'],
  ['PROMPT', DEFAULT_PROMPT_TEMPLATE],
];

const COMMAND_ALIASES: Record<string, string> = {
  chdir: 'cd',
  erase: 'del',
  rm: 'del',
  md: 'mkdir',
  rd: 'rmdir',
  ren: 'rename',
};

const HELP_TOPICS: Record<string, string[]> = {
  dir: [
    'Displays a list of files and subdirectories in a directory.',
    '',
    'DIR [drive:][path]',
  ],
  cd: [
    'Displays the name of or changes the current directory.',
    '',
    'CD [drive:][path]',
    'CD [..]',
  ],
  cls: ['Clears the screen.'],
  type: ['Displays the contents of a text file.', '', 'TYPE <filename>'],
  copy: ['Copies one file to another location.', '', 'COPY <source> <destination>'],
  del: ['Deletes one or more files.', '', 'DEL <filename>'],
  mkdir: ['Creates a directory.', '', 'MKDIR <path>'],
  rmdir: ['Removes an empty directory.', '', 'RMDIR <path>'],
  rename: ['Renames a file or directory.', '', 'RENAME <source> <destination>'],
  move: ['Moves a file to a new location.', '', 'MOVE <source> <destination>'],
  echo: ['Displays messages or toggles command echoing.', '', 'ECHO [ON | OFF | message]'],
  help: ['Provides help information for commands.', '', 'HELP [command]'],
  ver: ['Displays the Windows version.'],
  exit: ['Quits the MS-DOS Prompt.'],
  path: ['Displays or sets a search path for executable files.', '', 'PATH [newPath]'],
  set: ['Displays, sets, or removes environment variables.', '', 'SET [variable=[string]]'],
  prompt: ['Changes the command prompt.', '', 'PROMPT [text]'],
};

const HELP_OVERVIEW_ORDER = [
  'CD',
  'CHDIR',
  'CLS',
  'COPY',
  'DEL',
  'DIR',
  'ECHO',
  'EXIT',
  'HELP',
  'MKDIR',
  'MOVE',
  'PATH',
  'PROMPT',
  'RENAME',
  'RMDIR',
  'SET',
  'TYPE',
  'VER',
];

function toDosPath(path: string): string {
  const { drive, segments } = parts(path);
  return segments.length === 0 ? `${drive}\\` : `${drive}\\${segments.join('\\')}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function decodeFile(node: VfsNode): string | undefined {
  if (node.kind !== 'file') {
    return undefined;
  }
  if (node.textContent !== undefined) {
    return node.textContent;
  }
  try {
    const decoder = new TextDecoder();
    return decoder.decode(node.content);
  } catch (error) {
    return undefined;
  }
}

function parseArguments(commandLine: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < commandLine.length; i += 1) {
    const char = commandLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current !== '') {
        result.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current !== '') {
    result.push(current);
  }
  return result;
}

function resolvePath(input: string | undefined, cwd: string): string {
  if (!input || input === '.') {
    return cwd;
  }

  const trimmed = input.trim();
  const driveMatch = trimmed.match(/^([a-zA-Z]):(.*)$/);
  let drive = parts(cwd).drive;
  let remainder = trimmed;
  if (driveMatch) {
    drive = `${driveMatch[1].toUpperCase()}:`;
    remainder = driveMatch[2] ?? '';
  }

  let segments = parts(cwd).segments.slice();
  if (driveMatch || remainder.startsWith('\\') || remainder.startsWith('/')) {
    segments = [];
  }

  const tokens = remainder
    .replace(/\\/g, '/')
    .split('/')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  tokens.forEach((token) => {
    if (token === '.') {
      return;
    }
    if (token === '..') {
      if (segments.length > 0) {
        segments = segments.slice(0, -1);
      }
      return;
    }
    segments.push(token);
  });

  const normalized = segments.length === 0 ? `${drive}/` : `${drive}/${segments.join('/')}`;
  return normalizePath(normalized);
}

function canonicalCommand(name: string): string {
  const lower = name.toLowerCase();
  return COMMAND_ALIASES[lower] ?? lower;
}

function getCommandToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^\S+/);
  return match ? match[0] : '';
}

function getCommandPayload(raw: string): string {
  const token = getCommandToken(raw);
  if (!token) {
    return '';
  }
  return raw.slice(token.length).trimStart();
}

export function createMsDosPromptApp({ vfs, onExit }: MsDosPromptDependencies): MsDosPromptInstance {
  const container = document.createElement('div');
  container.className = 'app-msdos';

  const output = document.createElement('div');
  output.className = 'app-msdos__output';
  container.appendChild(output);

  const inputForm = document.createElement('form');
  inputForm.className = 'app-msdos__input-line';

  const promptLabel = document.createElement('span');
  promptLabel.className = 'app-msdos__prompt';
  inputForm.appendChild(promptLabel);

  const inputField = document.createElement('input');
  inputField.className = 'app-msdos__input';
  inputField.type = 'text';
  inputField.spellcheck = false;
  inputField.autocomplete = 'off';
  inputField.autocapitalize = 'off';
  inputForm.appendChild(inputField);

  container.appendChild(inputForm);

  const history: string[] = [];
  let historyIndex = -1;

  let cwd = 'C:/';
  const environment = new Map<string, string>(DEFAULT_ENVIRONMENT);
  let promptTemplate = environment.get('PROMPT') ?? DEFAULT_PROMPT_TEMPLATE;
  let echoEnabled = true;
  let mountedHost: HTMLElement | undefined;
  let cleanupWindowBodyPadding: (() => void) | undefined;

  function addClassName(element: HTMLElement, className: string) {
    const classList = element.classList as DOMTokenList | undefined;
    if (classList && typeof classList.add === 'function') {
      classList.add(className);
      return;
    }
    const existing = typeof element.className === 'string'
      ? element.className.split(/\s+/).filter((token) => token.length > 0)
      : [];
    if (!existing.includes(className)) {
      existing.push(className);
    }
    element.className = existing.join(' ');
  }

  function removeClassName(element: HTMLElement, className: string) {
    const classList = element.classList as DOMTokenList | undefined;
    if (classList && typeof classList.remove === 'function') {
      classList.remove(className);
      return;
    }
    if (typeof element.className !== 'string') {
      return;
    }
    const filtered = element.className
      .split(/\s+/)
      .filter((token) => token.length > 0 && token !== className);
    element.className = filtered.join(' ');
  }

  function applyWindowBodyFlush(host: HTMLElement) {
    queueMicrotask(() => {
      if (mountedHost !== host) {
        return;
      }

      let current: HTMLElement | null = host;
      let windowBody: HTMLElement | null = null;
      while (current) {
        const hasClassList = current.classList?.contains?.('window-body');
        const hasClassName = typeof current.className === 'string'
          && current.className.split(/\s+/).includes('window-body');
        if (hasClassList || hasClassName) {
          windowBody = current;
          break;
        }
        current = current.parentElement;
      }

      if (!windowBody) {
        return;
      }

      if (cleanupWindowBodyPadding) {
        cleanupWindowBodyPadding();
      }

      cleanupWindowBodyPadding = () => {
        if (!windowBody) {
          return;
        }
        removeClassName(windowBody, 'window-body--flush');
      };
      addClassName(windowBody, 'window-body--flush');
    });
  }

  function formatPrompt(): string {
    const drive = parts(cwd).drive;
    const driveLetter = drive.charAt(0);
    const pathValue = toDosPath(cwd);
    let result = promptTemplate;
    result = result.replace(/\$\$/gi, '\u0000');
    result = result.replace(/\$p/gi, pathValue);
    result = result.replace(/\$n/gi, driveLetter);
    result = result.replace(/\$g/gi, '>');
    result = result.replace(/\$l/gi, '<');
    result = result.replace(/\$b/gi, '|');
    result = result.replace(/\$q/gi, '=');
    result = result.replace(/\$h/gi, '');
    result = result.replace(/\u0000/g, '$');
    return result;
  }

  function updatePrompt() {
    promptLabel.textContent = formatPrompt();
  }

  function appendLine(text = '') {
    const line = document.createElement('div');
    line.className = 'app-msdos__line';
    line.textContent = text;
    output.appendChild(line);
    if (typeof output.scrollTop === 'number' && typeof output.scrollHeight === 'number') {
      output.scrollTop = output.scrollHeight;
    }
  }

  function appendLines(lines: string[]) {
    lines.forEach((line) => appendLine(line));
  }

  function resetScreen() {
    output.innerHTML = '';
    appendLines(INITIAL_BANNER);
  }

  function appendVolumeInfo(path: string) {
    const drive = parts(path).drive;
    const driveLetter = drive.charAt(0);
    appendLine(` Volume in drive ${driveLetter} is ${DEFAULT_VOLUME_LABEL}`);
    appendLine(` Volume Serial Number is ${DEFAULT_VOLUME_SERIAL}`);
    appendLine('');
  }

  const commandHelp: CommandHandler = (args, _raw) => {
    if (args.length === 0) {
      appendLine('For more information on a specific command, type HELP command-name');
      appendLine('');
      appendLine('Commands:');
      HELP_OVERVIEW_ORDER.forEach((entry) => {
        const canonical = canonicalCommand(entry);
        const description = HELP_TOPICS[canonical]?.[0] ?? '';
        appendLine(`  ${entry.padEnd(10, ' ')}${description}`);
      });
      return;
    }

    const topicToken = args[0];
    const topic = canonicalCommand(topicToken);
    const help = HELP_TOPICS[topic];
    if (!help) {
      appendLine(`No help available for ${topicToken.toUpperCase()}.`);
      return;
    }
    appendLines([`${topicToken.toUpperCase()}`, '']);
    appendLines(help);
  };

  const commandDir: CommandHandler = async (args, raw) => {
    if (args[0] === '/?') {
      commandHelp(['dir'], raw);
      return;
    }

    const targetPath = resolvePath(args[0], cwd);
    let node: VfsNode;
    try {
      node = await vfs.read(targetPath);
    } catch (error) {
      appendLine('File Not Found');
      return;
    }

    const directoryPath = node.kind === 'directory' ? node.path : dirname(node.path);
    appendVolumeInfo(directoryPath);
    appendLine(` Directory of ${toDosPath(directoryPath)}`);
    appendLine('');

    if (node.kind === 'directory') {
      appendLine('.'.padEnd(24, ' ') + '<DIR>');
      const parentPath = parts(directoryPath).segments.length > 0 ? dirname(directoryPath) : undefined;
      appendLine('..'.padEnd(24, ' ') + (parentPath ? '<DIR>' : ''));

      const entries = await vfs.list(node.path);
      const sorted = entries
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }));

      let fileCount = 0;
      let dirCount = 0;
      let totalBytes = 0;

      sorted.forEach((entry) => {
        if (entry.kind === 'directory') {
          appendLine(`${entry.name.padEnd(24, ' ')}<DIR>`);
          dirCount += 1;
        } else {
          appendLine(`${entry.name.padEnd(24, ' ')}${formatNumber(entry.size).padStart(12, ' ')}`);
          fileCount += 1;
          totalBytes += entry.size;
        }
      });

      appendLine('');
      appendLine(`${formatNumber(fileCount)} File(s)  ${formatNumber(totalBytes)} bytes`);
      const parentCount = parts(directoryPath).segments.length > 0 ? 2 : 1;
      appendLine(`${formatNumber(dirCount + parentCount)} Dir(s)`);
      return;
    }

    appendLine(`${node.name.padEnd(24, ' ')}${formatNumber(node.size).padStart(12, ' ')}`);
  };

  const commandCd: CommandHandler = async (args, _raw) => {
    const pathArg = args[0];
    if (!pathArg) {
      appendLine(toDosPath(cwd));
      return;
    }

    const target = resolvePath(pathArg, cwd);
    let node: VfsNode;
    try {
      node = await vfs.read(target);
    } catch (error) {
      appendLine('The system cannot find the path specified.');
      return;
    }

    if (node.kind !== 'directory') {
      appendLine('The directory name is invalid.');
      return;
    }

    cwd = node.path;
  };

  const commandCls: CommandHandler = () => {
    resetScreen();
  };

  const commandType: CommandHandler = async (args, _raw) => {
    if (args.length === 0) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }
    const target = resolvePath(args[0], cwd);
    let node: VfsNode;
    try {
      node = await vfs.read(target);
    } catch (error) {
      appendLine('File Not Found');
      return;
    }
    if (node.kind !== 'file') {
      appendLine('Access denied');
      return;
    }
    const decoded = decodeFile(node);
    if (decoded === undefined) {
      appendLine('File contains binary data.');
      return;
    }
    decoded.split(/\r?\n/).forEach((line) => appendLine(line));
  };

  const commandCopy: CommandHandler = async (args, _raw) => {
    if (args.length < 2) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    const destArg = args[args.length - 1];
    const sourceArg = args.slice(0, -1).join(' ');
    const sourcePath = resolvePath(sourceArg, cwd);

    let sourceNode: VfsNode;
    try {
      sourceNode = await vfs.read(sourcePath);
    } catch (error) {
      appendLine('File Not Found');
      return;
    }

    if (sourceNode.kind !== 'file') {
      appendLine('Cannot copy directories.');
      return;
    }

    const destinationPath = resolvePath(destArg, cwd);
    let targetPath = destinationPath;
    try {
      const destinationNode = await vfs.read(destinationPath);
      if (destinationNode.kind === 'directory') {
        const { drive, segments } = parts(destinationNode.path);
        const next = segments.concat([sourceNode.name]);
        targetPath = normalizePath(`${drive}/${next.join('/')}`);
      }
    } catch (error) {
      const parentDir = dirname(destinationPath);
      try {
        const parentNode = await vfs.read(parentDir);
        if (parentNode.kind !== 'directory') {
          appendLine('The directory name is invalid.');
          return;
        }
      } catch (parentError) {
        appendLine('The system cannot find the path specified.');
        return;
      }
    }

    const content = sourceNode.textContent ?? sourceNode.content;
    await vfs.writeFile(targetPath, content);
    appendLine('        1 file(s) copied.');
  };

  const commandDel: CommandHandler = async (args, _raw) => {
    if (args.length === 0) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    let removed = 0;
    for (const token of args) {
      const target = resolvePath(token, cwd);
      let node: VfsNode;
      try {
        node = await vfs.read(target);
      } catch (error) {
        appendLine('File Not Found');
        continue;
      }
      if (node.kind !== 'file') {
        appendLine('Access denied');
        continue;
      }
      await vfs.remove(node.path);
      removed += 1;
    }

    if (removed > 0) {
      appendLine(`        ${formatNumber(removed)} file(s) deleted.`);
    }
  };

  const commandMkdir: CommandHandler = async (args, _raw) => {
    if (args.length === 0) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    for (const token of args) {
      const target = resolvePath(token, cwd);
      try {
        await vfs.makeDirectory(target);
      } catch (error) {
        appendLine('A subdirectory or file already exists.');
      }
    }
  };

  const commandRmdir: CommandHandler = async (args, _raw) => {
    if (args.length === 0) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    for (const token of args) {
      const target = resolvePath(token, cwd);
      let node: VfsNode;
      try {
        node = await vfs.read(target);
      } catch (error) {
        appendLine('The system cannot find the path specified.');
        continue;
      }
      if (node.kind !== 'directory') {
        appendLine('The directory name is invalid.');
        continue;
      }
      const contents = await vfs.list(node.path);
      if (contents.length > 0) {
        appendLine('The directory is not empty.');
        continue;
      }
      await vfs.remove(node.path);
    }
  };

  const commandRename: CommandHandler = async (args, _raw) => {
    if (args.length < 2) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    const sourceArg = args[0];
    const targetArg = args.slice(1).join(' ');
    if (!sourceArg || !targetArg) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    const sourcePath = resolvePath(sourceArg, cwd);
    let node: VfsNode;
    try {
      node = await vfs.read(sourcePath);
    } catch (error) {
      appendLine('File Not Found');
      return;
    }

    let destinationPath: string;
    if (/^[\\/]/.test(targetArg) || targetArg.includes(':')) {
      destinationPath = resolvePath(targetArg, cwd);
    } else {
      const { drive, segments } = parts(node.path);
      const baseSegments = segments.slice(0, -1);
      destinationPath = normalizePath(
        baseSegments.length === 0
          ? `${drive}/${targetArg}`
          : `${drive}/${baseSegments.concat([targetArg]).join('/')}`,
      );
    }

    try {
      await vfs.move(node.path, destinationPath);
    } catch (error) {
      appendLine('Cannot rename the file specified.');
      return;
    }
  };

  const commandMove: CommandHandler = async (args, _raw) => {
    if (args.length < 2) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }

    const destArg = args[args.length - 1];
    const sourceArg = args.slice(0, -1).join(' ');
    if (!sourceArg) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }
    const sourcePath = resolvePath(sourceArg, cwd);

    let node: VfsNode;
    try {
      node = await vfs.read(sourcePath);
    } catch (error) {
      appendLine('File Not Found');
      return;
    }

    let destinationPath = resolvePath(destArg, cwd);
    try {
      const destNode = await vfs.read(destinationPath);
      if (destNode.kind === 'directory') {
        const { drive, segments } = parts(destNode.path);
        const next = segments.concat([node.name]);
        destinationPath = normalizePath(`${drive}/${next.join('/')}`);
      }
    } catch (error) {
      const parent = dirname(destinationPath);
      try {
        await vfs.read(parent);
      } catch (parentError) {
        appendLine('The system cannot find the path specified.');
        return;
      }
    }

    try {
      await vfs.move(node.path, destinationPath);
    } catch (error) {
      appendLine('Cannot move the file specified.');
      return;
    }
  };

  const commandEcho: CommandHandler = (args, raw) => {
    if (args.length === 0) {
      appendLine(`ECHO is ${echoEnabled ? 'on' : 'off'}.`);
      return;
    }

    const directive = args[0].toLowerCase();
    if (directive === 'on') {
      echoEnabled = true;
      appendLine('ECHO is on.');
      return;
    }
    if (directive === 'off') {
      echoEnabled = false;
      appendLine('ECHO is off.');
      return;
    }

    if (!echoEnabled) {
      return;
    }

    const message = getCommandPayload(raw) || args.join(' ');
    if (message === '.') {
      appendLine('');
      return;
    }
    appendLine(message);
  };

  const commandVer: CommandHandler = () => {
    appendLine('Microsoft Windows 95 [Version 4.00.950]');
    appendLine('');
  };

  const commandExit: CommandHandler = () => {
    onExit?.();
  };

  const commandPath: CommandHandler = (_args, raw) => {
    const payload = getCommandPayload(raw).replace(/^=/, '');
    if (!payload) {
      appendLine(`PATH=${environment.get('PATH') ?? ''}`);
      return;
    }
    environment.set('PATH', payload);
    appendLine(`PATH=${payload}`);
  };

  const commandSet: CommandHandler = (_args, raw) => {
    const payload = getCommandPayload(raw);
    if (!payload) {
      const entries = Array.from(environment.entries()).sort(([a], [b]) => a.localeCompare(b));
      entries.forEach(([key, value]) => appendLine(`${key}=${value}`));
      return;
    }

    const equalsIndex = payload.indexOf('=');
    if (equalsIndex === -1) {
      const prefix = payload.toUpperCase();
      const matches = Array.from(environment.entries()).filter(([key]) => key.startsWith(prefix));
      matches.forEach(([key, value]) => appendLine(`${key}=${value}`));
      return;
    }

    const name = payload.slice(0, equalsIndex).trim();
    const value = payload.slice(equalsIndex + 1);
    if (!name) {
      appendLine('The syntax of the command is incorrect.');
      return;
    }
    const key = name.toUpperCase();
    if (value === '') {
      environment.delete(key);
      if (key === 'PROMPT') {
        promptTemplate = DEFAULT_PROMPT_TEMPLATE;
        environment.set('PROMPT', promptTemplate);
        updatePrompt();
      }
      return;
    }
    environment.set(key, value);
    if (key === 'PROMPT') {
      promptTemplate = value;
      updatePrompt();
    }
  };

  const commandPrompt: CommandHandler = (_args, raw) => {
    const payload = getCommandPayload(raw);
    if (!payload) {
      appendLine(`PROMPT=${promptTemplate}`);
      return;
    }
    promptTemplate = payload || DEFAULT_PROMPT_TEMPLATE;
    environment.set('PROMPT', promptTemplate);
    updatePrompt();
  };

  const commands: Record<string, CommandHandler> = {
    dir: commandDir,
    cd: commandCd,
    chdir: commandCd,
    cls: commandCls,
    type: commandType,
    copy: commandCopy,
    del: commandDel,
    erase: commandDel,
    rm: commandDel,
    mkdir: commandMkdir,
    md: commandMkdir,
    rmdir: commandRmdir,
    rd: commandRmdir,
    rename: commandRename,
    ren: commandRename,
    move: commandMove,
    echo: commandEcho,
    help: commandHelp,
    ver: commandVer,
    exit: commandExit,
    path: commandPath,
    set: commandSet,
    prompt: commandPrompt,
  };

  async function execute(rawInput: string): Promise<void> {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return;
    }

    const driveMatch = trimmed.match(/^([a-zA-Z]):$/);
    if (driveMatch) {
      const driveRoot = `${driveMatch[1].toUpperCase()}:`;
      const drivePath = `${driveRoot}/`;
      try {
        const node = await vfs.read(drivePath);
        if (node.kind === 'directory') {
          cwd = node.path;
        } else {
          appendLine('Invalid drive specification');
        }
      } catch (error) {
        appendLine('Invalid drive specification');
      }
      return;
    }

    const args = parseArguments(trimmed);
    if (args.length === 0) {
      return;
    }

    const commandToken = args[0];
    const commandName = commandToken.toLowerCase();
    const handler = commands[commandName];
    if (!handler) {
      appendLine('Bad command or file name');
      return;
    }

    await handler(args.slice(1), trimmed);
  }

  const submitHandler = async (event: Event) => {
    event.preventDefault();
    const commandText = inputField.value;
    const trimmed = commandText.trim();
    if (echoEnabled || trimmed.length > 0) {
      appendLine(`${promptLabel.textContent ?? ''} ${commandText}`.trimEnd());
    }
    inputField.value = '';
    if (trimmed.length > 0) {
      history.push(commandText);
      historyIndex = history.length;
    }
    inputField.disabled = true;
    try {
      await execute(commandText);
    } finally {
      const connectedValue = (inputField as unknown as { isConnected?: boolean }).isConnected;
      if (connectedValue === false) {
        return;
      }
      updatePrompt();
      inputField.disabled = false;
      inputField.focus();
    }
  };

  const keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') {
      if (historyIndex > 0) {
        historyIndex -= 1;
        inputField.value = history[historyIndex] ?? '';
        setTimeout(() => inputField.setSelectionRange?.(inputField.value.length, inputField.value.length));
      }
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown') {
      if (historyIndex < history.length) {
        historyIndex += 1;
        inputField.value = history[historyIndex] ?? '';
        setTimeout(() => inputField.setSelectionRange?.(inputField.value.length, inputField.value.length));
      }
      event.preventDefault();
    }
  };

  inputForm.addEventListener('submit', submitHandler);
  inputField.addEventListener('keydown', keyHandler);

  function mount(host: HTMLElement) {
    if (mountedHost === host) {
      return;
    }
    cleanupWindowBodyPadding?.();
    if (mountedHost) {
      removeClassName(mountedHost, 'app-msdos__host');
    }
    mountedHost = host;
    host.innerHTML = '';
    addClassName(host, 'app-msdos__host');
    host.appendChild(container);
    applyWindowBodyFlush(host);
    resetScreen();
    updatePrompt();
    inputField.focus();
  }

  function destroy() {
    cleanupWindowBodyPadding?.();
    cleanupWindowBodyPadding = undefined;
    if (typeof inputForm.removeEventListener === 'function') {
      inputForm.removeEventListener('submit', submitHandler);
    }
    if (typeof inputField.removeEventListener === 'function') {
      inputField.removeEventListener('keydown', keyHandler);
    }
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
    if (mountedHost) {
      removeClassName(mountedHost, 'app-msdos__host');
    }
    mountedHost = undefined;
  }

  function focus() {
    inputField.focus();
  }

  return { mount, destroy, focus };
}
