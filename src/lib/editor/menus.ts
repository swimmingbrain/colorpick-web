import type { MenuItem } from '$lib/stores/app';
import type { Preferences } from './settings';
import { commandById, keysOf } from './actions';
import { keyLabel } from './keys';

export interface TopMenu {
  label: string;
  items: MenuItem[];
}

const SEP: MenuItem = { label: '', separator: true };

// what the menus need to know to gray out and tick entries
export interface MenuContext {
  sharing: boolean;
  live: boolean;
  hasColor: boolean;
  hasHistory: boolean;
  hasSelection: boolean;
}

// a menu entry for a command with the key it answers to now, the label can read a little different
export function commandItem(id: string, shortcuts: Record<string, string>, extra: Partial<MenuItem> = {}): MenuItem {
  const cmd = commandById(id);
  if (!cmd) return { label: id, disabled: true };
  const key = keysOf(id, shortcuts)[0];
  return { label: cmd.label, shortcut: key ? keyLabel(key) : undefined, action: cmd.run, ...extra };
}

export function buildMenus(p: Preferences, ctx: MenuContext): TopMenu[] {
  const c = (id: string, extra: Partial<MenuItem> = {}): MenuItem => commandItem(id, p.shortcuts, extra);
  return [
    {
      label: 'File',
      items: [
        c('file.export-json', { label: 'Export JSON...', disabled: !ctx.hasHistory }),
        c('file.export-csv', { label: 'Export CSV...', disabled: !ctx.hasHistory }),
        SEP,
        c('file.clear', { label: 'Clear history...', disabled: !ctx.hasHistory, danger: ctx.hasHistory })
      ]
    },
    {
      label: 'Edit',
      items: [
        c('edit.copy-hex', { disabled: !ctx.hasColor }),
        c('edit.copy-rgb', { disabled: !ctx.hasColor }),
        SEP,
        c('edit.delete', { disabled: !ctx.hasSelection }),
        SEP,
        c('edit.palette', { label: 'Command palette...' }),
        c('edit.preferences', { label: 'Preferences...' })
      ]
    },
    {
      label: 'View',
      items: [
        c('tool.live', { checked: ctx.sharing && ctx.live, disabled: !ctx.sharing }),
        c('view.loupe', { checked: p.stage.loupe }),
        c('view.log', { checked: p.histogram.log }),
        SEP,
        {
          label: 'Toolbar side',
          children: [
            c('view.toolbar-left', { label: 'Left', checked: p.toolbar.side === 'left' }),
            c('view.toolbar-right', { label: 'Right', checked: p.toolbar.side === 'right' })
          ]
        },
        c('view.reset-panels')
      ]
    },
    {
      label: 'Help',
      items: [c('help.shortcuts'), SEP, c('help.about'), c('help.github')]
    }
  ];
}
