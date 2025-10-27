export interface WindowsHelpAppOptions {
  requestClose?: () => void;
}

export interface WindowsHelpAppInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
  showTab(id: 'contents' | 'index' | 'find'): void;
}

type HelpContentTopic = {
  type: 'topic';
  id: string;
  title: string;
  icon: string;
  summary: string;
  body: string;
};

type HelpContentBook = {
  type: 'book';
  id: string;
  title: string;
  iconClosed: string;
  iconOpen: string;
  intro: string;
  children: HelpContentNode[];
};

type HelpContentNode = HelpContentTopic | HelpContentBook;

interface HelpIndexEntry {
  id: string;
  term: string;
  description: string;
  related?: string[];
}

interface HelpSearchOption {
  id: string;
  label: string;
  description: string;
}

const CONTENT_TREE: HelpContentNode[] = [
  {
    type: 'book',
    id: 'book-new-to-windows',
    title: "If you're new to Windows 95",
    iconClosed: 'icons/w98_help_book_small.ico',
    iconOpen: 'icons/w98_help_book_cool_small.ico',
    intro:
      'Welcome to Windows 95 Help. Select a topic, or expand a book to browse step-by-step assistance for everyday tasks.',
    children: [
      {
        type: 'topic',
        id: 'topic-whats-new',
        title: "What's new in Windows 95",
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Discover the Start menu, taskbar, and Explorer improvements added in Windows 95.',
        body: [
          'Windows 95 introduces the Start button, a single place to open programs, documents, and system tools.',
          'The taskbar keeps track of your open windows. Click a button to switch tasks or press ALT+TAB to cycle through them.',
          'Windows Explorer replaces File Manager and presents drives and folders in a single tree so you can drag and drop items easily.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-desktop-tour',
        title: 'Touring the desktop',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Learn what each desktop icon does and how to customize the workspace.',
        body: [
          'The desktop starts with icons such as My Computer, Network Neighborhood, and the Recycle Bin. Double-click an icon to open it.',
          'Right-click the desktop background to open the Display control panel where you can change wallpaper, colors, and screen savers.',
          'Drag icons to arrange them. Use the Arrange command on the desktop shortcut menu to reset them to a tidy grid.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-start-button',
        title: 'Using the Start button',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Open the Start menu to launch programs, find files, or shut down your computer.',
        body: [
          'Click the Start button once to open the Start menu. Programs, Documents, Settings, Find, and Help are available at a glance.',
          'Choose Shut Down to safely turn off or restart your computer. Always close programs and use Shut Down before powering off.',
          'Select Find to locate files by name, or use the Run command to start an application by typing its filename.',
        ].join('\n\n'),
      },
    ],
  },
  {
    type: 'book',
    id: 'book-everyday-tasks',
    title: 'Doing everyday tasks',
    iconClosed: 'icons/w98_help_book_small.ico',
    iconOpen: 'icons/w98_help_book_cool.ico',
    intro: 'These topics walk through the most common activities such as working with documents and printing.',
    children: [
      {
        type: 'topic',
        id: 'topic-open-save',
        title: 'Opening and saving documents',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Understand the common Open and Save As dialogs shared across Windows programs.',
        body: [
          'When a program asks you to open or save a file, use the Look In list to browse drives and folders. Double-click folders to open them.',
          'Use the File name box to type a name. The Save as type list lets you choose between file formats such as Word document or text file.',
          'Click the History button to review recently used folders. Many dialogs also let you create a new folder before saving.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-printing',
        title: 'Printing your work',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Send a document to the printer and resolve simple printing issues.',
        body: [
          'Choose File > Print to open the Print dialog. Select a printer and pick the number of copies you need.',
          'If nothing prints, confirm the printer is online and has paper. Double-click the printer icon in the taskbar to view the print queue.',
          'Use the Cancel command in the queue window to remove a job that is stuck or sending incorrect pages.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-shortcuts',
        title: 'Creating desktop shortcuts',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Make a shortcut to programs, folders, and documents you open frequently.',
        body: [
          'Right-click a file or folder and choose Create Shortcut. Drag the shortcut to the desktop or another folder for quick access.',
          'You can also drag a file with the right mouse button and choose Create Shortcut Here when you drop it.',
          'Rename a shortcut to something meaningful so you recognize it later. The original file stays in place.',
        ].join('\n\n'),
      },
    ],
  },
  {
    type: 'book',
    id: 'book-communication',
    title: 'Communicating and the Internet',
    iconClosed: 'icons/w98_help_book_small.ico',
    iconOpen: 'icons/w98_help_book_cool_small.ico',
    intro: 'Windows 95 includes built-in tools to connect to networks and the Internet.',
    children: [
      {
        type: 'topic',
        id: 'topic-dial-up',
        title: 'Setting up Dial-Up Networking',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Create a connection to your Internet or remote access provider.',
        body: [
          'Open My Computer and double-click Dial-Up Networking. The Make New Connection wizard guides you through the setup.',
          'Enter the telephone number provided by your service, then choose the modem you installed in the Modems Control Panel.',
          'After creating the connection, double-click it and supply your username and password to connect.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-email',
        title: 'Sending e-mail messages',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Use Microsoft Exchange or another mail program to send and receive messages.',
        body: [
          'Launch your mail program from the Start menu. Choose New Message to write a note and enter each recipient in the To box.',
          'Click the Address Book button to look up contacts. Attach files with the Attach command before you send the message.',
          'Use Send and Receive to check for incoming mail. You may need to connect to your Internet provider first.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-browser',
        title: 'Browsing the World Wide Web',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Get started with an Internet browser to explore websites and download information.',
        body: [
          'Open your Internet browser from the Internet group on the Start menu. The address box lets you type a web address such as http://www.microsoft.com.',
          'Use the Back and Forward buttons to revisit pages. Add favorites so you can return to frequently visited sites.',
          'If a page will not load, click Stop and then Refresh. Check your modem connection and try again.',
        ].join('\n\n'),
      },
    ],
  },
  {
    type: 'book',
    id: 'book-troubleshooting',
    title: 'Fixing a problem',
    iconClosed: 'icons/w98_help_book_small.ico',
    iconOpen: 'icons/w98_help_book_cool_small.ico',
    intro: 'Troubleshoot common hardware and software issues using these guided checklists.',
    children: [
      {
        type: 'topic',
        id: 'topic-safe-mode',
        title: 'Starting Windows in Safe Mode',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Boot Windows with a minimal set of drivers to solve startup issues.',
        body: [
          'Restart the computer and press F8 when the Starting Windows 95 message appears. Choose Safe Mode from the Startup Menu.',
          'In Safe Mode, Windows loads only essential drivers so you can remove or reconfigure problem hardware.',
          'When you finish, restart normally. If the issue returns, reinstall or update the driver that caused the problem.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-sound',
        title: 'No sound from speakers',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Check volume controls and driver status to restore audio.',
        body: [
          'Verify the speakers are turned on and the volume knob is raised. Check the Volume Control in the taskbar to ensure nothing is muted.',
          'Open the Multimedia Control Panel and confirm your preferred playback device is selected.',
          'If sound still does not play, reinstall the sound card driver using the Add New Hardware wizard.',
        ].join('\n\n'),
      },
      {
        type: 'topic',
        id: 'topic-printer-jam',
        title: 'Clearing a printer jam',
        icon: 'icons/w98_help_sheet.ico',
        summary: 'Resolve most paper jams and resume printing quickly.',
        body: [
          'Turn off the printer and open the access panel. Remove any loose paper carefully so it does not tear.',
          'Check the paper path for scraps that might still be stuck. Reload the tray with fresh paper aligned to the guides.',
          'Turn the printer back on and resend your print job. If the jam recurs, consult the printer manual for maintenance steps.',
        ].join('\n\n'),
      },
    ],
  },
];

const INDEX_ENTRIES: HelpIndexEntry[] = [
  {
    id: 'index-start-menu',
    term: 'Start menu',
    description: 'Learn how to open programs, documents, and system tools from one menu.',
    related: ['Programs', 'Shut Down', 'Run'],
  },
  {
    id: 'index-explorer',
    term: 'Explorer',
    description: 'Browse drives, move files, and create folders using Windows Explorer.',
    related: ['folders', 'drag and drop'],
  },
  {
    id: 'index-printers',
    term: 'printers',
    description: 'Install printers, manage the queue, and solve common printing problems.',
    related: ['print queue', 'drivers'],
  },
  {
    id: 'index-shortcuts',
    term: 'shortcuts',
    description: 'Create desktop or Start menu shortcuts to files, folders, and programs.',
    related: ['desktop icons', 'dragging'],
  },
  {
    id: 'index-safe-mode',
    term: 'Safe Mode',
    description: 'Start Windows with basic drivers to troubleshoot startup issues.',
    related: ['troubleshooting', 'startup menu'],
  },
];

const FIND_TIPS: HelpSearchOption[] = [
  {
    id: 'titles',
    label: 'List topics that contain the words',
    description: 'Search book titles and help topics for an exact match.',
  },
  {
    id: 'full-text',
    label: 'Search titles and text',
    description: 'Scan the full help text to include partial matches or phrases.',
  },
  {
    id: 'glossary',
    label: 'Match similar words',
    description: 'Include glossary terms and synonyms for what you type.',
  },
];
function splitIntoParagraphs(container: HTMLElement, text: string) {
  container.textContent = '';
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  trimmed.split(/\n\s*\n/).forEach((paragraph) => {
    const p = document.createElement('p');
    p.textContent = paragraph.trim();
    container.appendChild(p);
  });
}

function getClassTokens(element: HTMLElement): Set<string> {
  const value = typeof element.className === 'string' ? element.className : '';
  return new Set(value.split(/\s+/).filter(Boolean));
}

function syncClassTokens(element: HTMLElement, tokens: Set<string>) {
  element.className = Array.from(tokens).join(' ');
}

function setClassToken(element: HTMLElement, token: string, active: boolean) {
  const tokens = getClassTokens(element);
  if (active) {
    tokens.add(token);
  } else {
    tokens.delete(token);
  }
  syncClassTokens(element, tokens);
}

function findFirstTopic(nodes: HelpContentNode[]): HelpContentTopic | null {
  for (const node of nodes) {
    if (node.type === 'topic') {
      return node;
    }
    if (node.type === 'book') {
      const child = findFirstTopic(node.children);
      if (child) {
        return child;
      }
    }
  }
  return null;
}

function findTopicPath(
  nodes: HelpContentNode[],
  topicId: string,
  ancestors: HelpContentBook[] = [],
): { topic: HelpContentTopic; ancestors: HelpContentBook[] } | null {
  for (const node of nodes) {
    if (node.type === 'topic' && node.id === topicId) {
      return { topic: node, ancestors };
    }
    if (node.type === 'book') {
      const match = findTopicPath(node.children, topicId, ancestors.concat(node));
      if (match) {
        return match;
      }
    }
  }
  return null;
}

export function createWindowsHelpApp(options: WindowsHelpAppOptions = {}): WindowsHelpAppInstance {
  let hostElement: HTMLElement | null = null;
  let rootElement: HTMLElement | null = null;
  let activeTab: 'contents' | 'index' | 'find' = 'contents';
  const initialTopic = findFirstTopic(CONTENT_TREE);
  let activeTopicId: string = initialTopic?.id ?? '';
  let activeIndexId: string = INDEX_ENTRIES[0]?.id ?? '';
  const expandedBooks = new Set<string>();

  let detailsIcon: HTMLImageElement | null = null;
  let detailsTitle: HTMLElement | null = null;
  let detailsSummary: HTMLElement | null = null;
  let detailsBody: HTMLElement | null = null;
  let statusElement: HTMLElement | null = null;

  const cleanupCallbacks: Array<() => void> = [];
  const tabButtons = new Map<string, HTMLButtonElement>();
  const panels = new Map<string, HTMLElement>();
  const topicButtons = new Map<string, HTMLButtonElement>();
  const bookElements = new Map<
    string,
    {
      node: HelpContentBook;
      toggle: HTMLButtonElement;
      icon: HTMLImageElement;
      children: HTMLElement;
      label: HTMLButtonElement;
    }
  >();
  const indexButtons = new Map<string, HTMLButtonElement>();

  const topicPath = activeTopicId ? findTopicPath(CONTENT_TREE, activeTopicId) : null;
  if (topicPath) {
    topicPath.ancestors.forEach((book) => expandedBooks.add(book.id));
  }

  function register<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
    element: T,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ) {
    const listener = handler as EventListener;
    element.addEventListener(type, listener);
    cleanupCallbacks.push(() => {
      if (typeof element.removeEventListener === 'function') {
        element.removeEventListener(type, listener);
      }
    });
  }

  function setStatus(message: string) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function updateDetails(title: string, summary: string, body: string, icon?: string) {
    if (detailsTitle) {
      detailsTitle.textContent = title;
    }
    if (detailsSummary) {
      detailsSummary.textContent = summary;
    }
    if (detailsBody) {
      splitIntoParagraphs(detailsBody, body);
    }
    if (detailsIcon) {
      if (icon) {
        detailsIcon.src = icon;
      }
      detailsIcon.hidden = !icon;
    }
  }

  function syncTopicSelection(selectedId: string) {
    topicButtons.forEach((button, topicId) => {
      const active = topicId === selectedId;
      setClassToken(button, 'app-help__tree-button--active', active);
      if (active) {
        button.setAttribute('aria-selected', 'true');
        button.tabIndex = 0;
      } else {
        button.setAttribute('aria-selected', 'false');
        button.tabIndex = -1;
      }
    });
  }

  function toggleBook(bookId: string, expand?: boolean) {
    const references = bookElements.get(bookId);
    if (!references) {
      return;
    }
    const shouldExpand = expand ?? !expandedBooks.has(bookId);
    if (shouldExpand) {
      expandedBooks.add(bookId);
    } else {
      expandedBooks.delete(bookId);
    }
    references.toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    references.toggle.className = shouldExpand ? 'app-help__tree-toggle app-help__tree-toggle--expanded' : 'app-help__tree-toggle';
    if (shouldExpand) {
      references.children.removeAttribute('hidden');
      references.icon.src = references.node.iconOpen;
    } else {
      references.children.setAttribute('hidden', '');
      references.icon.src = references.node.iconClosed;
    }
  }

  function ensureTopicVisible(topicId: string) {
    const path = findTopicPath(CONTENT_TREE, topicId);
    if (!path) {
      return;
    }
    path.ancestors.forEach((ancestor) => {
      if (!expandedBooks.has(ancestor.id)) {
        toggleBook(ancestor.id, true);
      }
    });
  }

  function selectTopic(id: string) {
    const match = findTopicPath(CONTENT_TREE, id);
    if (!match) {
      return;
    }
    activeTopicId = id;
    ensureTopicVisible(id);
    syncTopicSelection(id);
    updateDetails(match.topic.title, match.topic.summary, match.topic.body, match.topic.icon);
    setStatus(`Displaying "${match.topic.title}"`);
  }

  function selectIndexEntry(id: string) {
    const entry = INDEX_ENTRIES.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    activeIndexId = entry.id;
    indexButtons.forEach((button, entryId) => {
      const active = entryId === id;
      setClassToken(button, 'app-help__index-entry--active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    const related = entry.related?.length ? `Related topics: ${entry.related.join(', ')}.` : '';
    updateDetails(entry.term, entry.description, related, 'icons/w98_help_question_mark.ico');
    setStatus(`Ready to display "${entry.term}"`);
  }

  function filterIndex(term: string) {
    const normalized = term.trim().toLowerCase();
    let firstMatch: string | null = null;
    INDEX_ENTRIES.forEach((entry) => {
      const button = indexButtons.get(entry.id);
      if (!button || !button.parentElement) {
        return;
      }
      const haystack = [entry.term, entry.description, ...(entry.related ?? [])]
        .join(' ')
        .toLowerCase();
      const match = normalized.length === 0 || haystack.includes(normalized);
      button.parentElement.style.display = match ? '' : 'none';
      if (match && !firstMatch) {
        firstMatch = entry.id;
      }
    });
    if (firstMatch) {
      selectIndexEntry(firstMatch);
    } else {
      updateDetails('No matches found', 'Windows Help could not find that word.', 'Try another spelling or search another tab.', 'icons/w98_help_question_mark.ico');
      setStatus('No index entries match your search.');
    }
  }

  function activateTab(id: 'contents' | 'index' | 'find') {
    if (!panels.has(id)) {
      return;
    }
    activeTab = id;
    tabButtons.forEach((button, tabId) => {
      const active = tabId === id;
      setClassToken(button, 'app-help__tab--active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel, panelId) => {
      if (panelId === id) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
    if (id === 'contents' && activeTopicId) {
      selectTopic(activeTopicId);
    } else if (id === 'index' && activeIndexId) {
      selectIndexEntry(activeIndexId);
    } else if (id === 'find') {
      updateDetails('Find Topics', 'Search the Help system for matching topics.', 'Type a word or phrase, then click Display to list matching help topics.', 'icons/w98_help_sheet.ico');
      setStatus('Type a word to find topics.');
    }
  }

  function handleDisplayAction() {
    if (activeTab === 'contents') {
      if (activeTopicId) {
        selectTopic(activeTopicId);
      }
      return;
    }
    if (activeTab === 'index') {
      if (activeIndexId) {
        selectIndexEntry(activeIndexId);
        const entry = INDEX_ENTRIES.find((item) => item.id === activeIndexId);
        if (entry) {
          setStatus(`Displayed index topic "${entry.term}"`);
        }
      }
      return;
    }
    setStatus('Searching for matching topics...');
  }

  function handlePrintAction() {
    const message = 'Printing help topics is not available in this simulator.';
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
    setStatus('Ready');
  }

  function handleMenuAction(label: string) {
    setStatus(`${label} menu commands are not available in this build.`);
  }
  function buildMenuBar(): HTMLElement {
    const menuBar = document.createElement('div');
    menuBar.className = 'app-help__menubar';
    const menus = ['File', 'Edit', 'Bookmark', 'Options', 'Help'];
    menus.forEach((menu) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-help__menubar-item';
      button.textContent = menu;
      register(button, 'click', () => handleMenuAction(menu));
      menuBar.appendChild(button);
    });
    return menuBar;
  }

  function buildToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'app-help__toolbar';
    const buttons: Array<{ id: string; icon: string; label: string; handler: () => void }> = [
      {
        id: 'back',
        icon: 'icons/w98_help_book_small.ico',
        label: 'Back',
        handler: () => setStatus('Back is not available.'),
      },
      {
        id: 'forward',
        icon: 'icons/w98_help_book_cool_small.ico',
        label: 'Forward',
        handler: () => setStatus('Forward is not available.'),
      },
      {
        id: 'home',
        icon: 'icons/w98_help_book_big.ico',
        label: 'Home',
        handler: () => {
          if (initialTopic) {
            selectTopic(initialTopic.id);
            activateTab('contents');
            setStatus('Returned to Help home.');
          }
        },
      },
      {
        id: 'print',
        icon: 'icons/w98_help_sheet.ico',
        label: 'Print',
        handler: handlePrintAction,
      },
      {
        id: 'options',
        icon: 'icons/w98_help_question_mark.ico',
        label: 'Options',
        handler: () => setStatus('Options will be available in a future build.'),
      },
    ];

    buttons.forEach((definition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-help__toolbar-button';
      button.title = definition.label;

      const icon = document.createElement('img');
      icon.className = 'app-help__toolbar-icon';
      icon.src = definition.icon;
      icon.alt = '';

      const label = document.createElement('span');
      label.className = 'app-help__toolbar-label';
      label.textContent = definition.label;

      button.appendChild(icon);
      button.appendChild(label);

      register(button, 'click', definition.handler);
      toolbar.appendChild(button);
    });

    return toolbar;
  }

  function buildContentsTree(nodes: HelpContentNode[], depth = 0): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'app-help__tree-list';
    if (depth === 0) {
      list.setAttribute('role', 'tree');
    } else {
      list.setAttribute('role', 'group');
    }

    nodes.forEach((node) => {
      const item = document.createElement('li');
      item.className = 'app-help__tree-node';
      item.dataset.depth = String(depth);

      if (node.type === 'book') {
        const row = document.createElement('div');
        row.className = 'app-help__tree-row app-help__tree-row--book';
        row.style.paddingLeft = `${depth * 16}px`;

        const expanded = expandedBooks.has(node.id);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = expanded
          ? 'app-help__tree-toggle app-help__tree-toggle--expanded'
          : 'app-help__tree-toggle';
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.title = expanded ? 'Collapse' : 'Expand';

        const icon = document.createElement('img');
        icon.className = 'app-help__tree-icon';
        icon.src = expanded ? node.iconOpen : node.iconClosed;
        icon.alt = '';

        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'app-help__tree-button app-help__tree-button--book';
        label.textContent = node.title;
        label.tabIndex = -1;

        register(toggle, 'click', () => {
          toggleBook(node.id);
          setStatus(`${expandedBooks.has(node.id) ? 'Expanded' : 'Collapsed'} "${node.title}"`);
        });
        register(label, 'click', () => {
          toggleBook(node.id, true);
          updateDetails(node.title, node.intro, 'Select a topic from this book to see detailed help.', node.iconOpen);
          setStatus(`Viewing the "${node.title}" book.`);
        });

        row.appendChild(toggle);
        row.appendChild(icon);
        row.appendChild(label);
        item.appendChild(row);

        const children = buildContentsTree(node.children, depth + 1);
        if (!expanded) {
          children.setAttribute('hidden', '');
        }
        item.appendChild(children);

        bookElements.set(node.id, { node, toggle, icon, children, label });
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-help__tree-button app-help__tree-button--topic';
        button.dataset.topicId = node.id;
        button.textContent = node.title;
        button.style.paddingLeft = `${depth * 16 + 28}px`;
        button.setAttribute('role', 'treeitem');
        button.setAttribute('aria-selected', 'false');
        button.tabIndex = -1;

        const icon = document.createElement('img');
        icon.className = 'app-help__tree-topic-icon';
        icon.src = node.icon;
        icon.alt = '';

        button.textContent = node.title;
        if (typeof button.insertBefore === 'function') {
          button.insertBefore(icon, button.firstChild ?? null);
        } else {
          button.appendChild(icon);
        }

        register(button, 'click', () => selectTopic(node.id));
        register(button, 'keydown', (event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const topics = Array.from(topicButtons.keys());
            const currentIndex = topics.indexOf(activeTopicId);
            const delta = event.key === 'ArrowUp' ? -1 : 1;
            const nextIndex = Math.min(Math.max(currentIndex + delta, 0), topics.length - 1);
            const nextId = topics[nextIndex];
            if (nextId) {
              selectTopic(nextId);
              topicButtons.get(nextId)?.focus();
            }
          }
        });

        item.appendChild(button);
        topicButtons.set(node.id, button);
      }

      list.appendChild(item);
    });

    return list;
  }

  function buildContentsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'app-help__panel app-help__panel--contents';

    const intro = document.createElement('p');
    intro.className = 'app-help__panel-intro';
    intro.textContent = 'Click a book to see its topics. Click a topic, and then click Display to read more about it.';
    panel.appendChild(intro);

    const treeFrame = document.createElement('div');
    treeFrame.className = 'app-help__tree-frame';
    treeFrame.appendChild(buildContentsTree(CONTENT_TREE));
    panel.appendChild(treeFrame);

    return panel;
  }

  function buildIndexPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'app-help__panel app-help__panel--index';
    panel.setAttribute('hidden', '');

    const label = document.createElement('label');
    label.className = 'app-help__index-label';
    label.textContent = 'Type the first few letters of the word you are looking for:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'app-help__index-input';

    label.appendChild(input);
    panel.appendChild(label);

    const list = document.createElement('ul');
    list.className = 'app-help__index-list';
    list.setAttribute('role', 'listbox');

    INDEX_ENTRIES.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'app-help__index-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-help__index-entry';
      button.textContent = entry.term;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', 'false');
      button.tabIndex = index === 0 ? 0 : -1;

      register(button, 'click', () => selectIndexEntry(entry.id));
      register(button, 'keydown', (event) => {
        if (event.key === 'Enter') {
          selectIndexEntry(entry.id);
          handleDisplayAction();
        }
      });

      item.appendChild(button);
      list.appendChild(item);
      indexButtons.set(entry.id, button);
    });

    panel.appendChild(list);

    register(input, 'input', () => filterIndex(input.value));

    return panel;
  }

  function buildFindPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'app-help__panel app-help__panel--find';
    panel.setAttribute('hidden', '');

    const description = document.createElement('p');
    description.className = 'app-help__find-description';
    description.textContent = 'The Find tab searches the entire help collection. Type a word or phrase, then choose where to search.';
    panel.appendChild(description);

    const label = document.createElement('label');
    label.className = 'app-help__find-label';
    label.textContent = 'List topics that contain these words:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'app-help__find-input';
    label.appendChild(input);
    panel.appendChild(label);

    const optionsList = document.createElement('ul');
    optionsList.className = 'app-help__find-options';

    FIND_TIPS.forEach((option, index) => {
      const item = document.createElement('li');
      item.className = 'app-help__find-option';
      const checkboxId = `app-help-find-${option.id}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.checked = index === 0;
      checkbox.className = 'app-help__find-checkbox';

      const checkboxLabel = document.createElement('label');
      checkboxLabel.setAttribute('for', checkboxId);
      checkboxLabel.className = 'app-help__find-option-label';
      checkboxLabel.textContent = option.label;

      const optionDescription = document.createElement('p');
      optionDescription.className = 'app-help__find-option-description';
      optionDescription.textContent = option.description;

      item.appendChild(checkbox);
      item.appendChild(checkboxLabel);
      item.appendChild(optionDescription);
      optionsList.appendChild(item);
    });

    panel.appendChild(optionsList);

    register(input, 'input', () => {
      if (input.value.trim().length > 0) {
        setStatus(`Ready to search for "${input.value.trim()}".`);
      } else {
        setStatus('Ready');
      }
    });

    return panel;
  }
  function buildViewer(): HTMLElement {
    const viewer = document.createElement('div');
    viewer.className = 'app-help__viewer';

    const header = document.createElement('div');
    header.className = 'app-help__viewer-header';

    const icon = document.createElement('img');
    icon.className = 'app-help__viewer-icon';
    icon.alt = '';
    detailsIcon = icon;

    const title = document.createElement('h3');
    title.className = 'app-help__viewer-title';
    detailsTitle = title;

    header.appendChild(icon);
    header.appendChild(title);
    viewer.appendChild(header);

    const summary = document.createElement('p');
    summary.className = 'app-help__viewer-summary';
    detailsSummary = summary;
    viewer.appendChild(summary);

    const divider = document.createElement('div');
    divider.className = 'app-help__viewer-divider';
    viewer.appendChild(divider);

    const body = document.createElement('div');
    body.className = 'app-help__viewer-body';
    detailsBody = body;
    viewer.appendChild(body);

    return viewer;
  }

  function buildFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'app-help__footer';

    const status = document.createElement('div');
    status.className = 'app-help__status';
    status.textContent = 'Ready';
    statusElement = status;

    const actions = document.createElement('div');
    actions.className = 'app-help__actions';

    const displayButton = document.createElement('button');
    displayButton.type = 'button';
    displayButton.className = 'app-help__action-button';
    displayButton.textContent = 'Display';
    register(displayButton, 'click', handleDisplayAction);

    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.className = 'app-help__action-button';
    printButton.textContent = 'Print...';
    register(printButton, 'click', handlePrintAction);

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'app-help__action-button';
    cancelButton.textContent = 'Cancel';
    register(cancelButton, 'click', () => options.requestClose?.());

    actions.appendChild(displayButton);
    actions.appendChild(printButton);
    actions.appendChild(cancelButton);

    footer.appendChild(status);
    footer.appendChild(actions);
    return footer;
  }

  function mount(host: HTMLElement) {
    if (hostElement) {
      return;
    }
    hostElement = host;
    setClassToken(hostElement, 'app-help__host', true);

    const root = document.createElement('div');
    root.className = 'app-help';
    rootElement = root;

    const menuBar = buildMenuBar();
    const toolbar = buildToolbar();

    const workspace = document.createElement('div');
    workspace.className = 'app-help__workspace';

    const navigation = document.createElement('div');
    navigation.className = 'app-help__navigation';

    const tabs = document.createElement('div');
    tabs.className = 'app-help__tabs';
    tabs.setAttribute('role', 'tablist');

    const tabDefinitions: Array<{ id: 'contents' | 'index' | 'find'; label: string }> = [
      { id: 'contents', label: 'Contents' },
      { id: 'index', label: 'Index' },
      { id: 'find', label: 'Find' },
    ];

    tabDefinitions.forEach((tab, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-help__tab';
      button.dataset.tabId = tab.id;
      button.textContent = tab.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      button.tabIndex = index === 0 ? 0 : -1;
      register(button, 'click', () => activateTab(tab.id));
      register(button, 'keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          const delta = event.key === 'ArrowLeft' ? -1 : 1;
          const nextIndex = (index + delta + tabDefinitions.length) % tabDefinitions.length;
          const nextTab = tabDefinitions[nextIndex];
          if (nextTab) {
            activateTab(nextTab.id);
            tabButtons.get(nextTab.id)?.focus();
          }
        }
      });
      tabs.appendChild(button);
      tabButtons.set(tab.id, button);
    });

    const panelsContainer = document.createElement('div');
    panelsContainer.className = 'app-help__panels';

    const contentsPanel = buildContentsPanel();
    panelsContainer.appendChild(contentsPanel);
    panels.set('contents', contentsPanel);

    const indexPanel = buildIndexPanel();
    panelsContainer.appendChild(indexPanel);
    panels.set('index', indexPanel);

    const findPanel = buildFindPanel();
    panelsContainer.appendChild(findPanel);
    panels.set('find', findPanel);

    navigation.appendChild(tabs);
    navigation.appendChild(panelsContainer);

    const viewer = buildViewer();

    workspace.appendChild(navigation);
    workspace.appendChild(viewer);

    const footer = buildFooter();

    root.appendChild(menuBar);
    root.appendChild(toolbar);
    root.appendChild(workspace);
    root.appendChild(footer);

    host.appendChild(root);

    if (activeTopicId) {
      selectTopic(activeTopicId);
    } else {
      updateDetails('Windows Help', 'Choose a book or tab to get started.', 'Use the buttons below to display detailed help topics.', 'icons/w98_help_question_mark.ico');
    }
  }

  function destroy() {
    cleanupCallbacks.splice(0).forEach((dispose) => dispose());
    topicButtons.clear();
    bookElements.clear();
    indexButtons.clear();
    tabButtons.clear();
    panels.clear();
    if (rootElement?.parentElement) {
      rootElement.parentElement.removeChild(rootElement);
    }
    if (hostElement) {
      setClassToken(hostElement, 'app-help__host', false);
    }
    hostElement = null;
    rootElement = null;
    detailsIcon = null;
    detailsTitle = null;
    detailsSummary = null;
    detailsBody = null;
    statusElement = null;
  }

  return {
    mount,
    destroy,
    showTab: activateTab,
  };
}
