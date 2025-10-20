module.exports = function sampleTree() {
  return [
    { path: 'C:/Projects', kind: 'directory' },
    { path: 'C:/Projects/Phase02.txt', kind: 'file', content: 'Explorer requirements' },
    { path: 'C:/Projects/Plans/timeline.md', kind: 'file', content: 'Milestones' },
    { path: 'C:/Projects/Plans', kind: 'directory' },
    { path: 'C:/Desktop', kind: 'directory' },
    { path: 'C:/Desktop/Explorer.lnk', kind: 'shortcut', target: 'C:/Projects' },
  ];
};
