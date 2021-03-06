const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const util = Me.imports.util;

const keyActivation = Me.imports.keyActivation.KeyActivation;

const ModeUtils = (function () {
  // From _loadApps() in GNOME Shell's appDisplay.js
  let appInfos = () => Gio.AppInfo.get_all().filter(function(appInfo) {
      try {
          let id = appInfo.get_id(); // catch invalid file encodings
      } catch(e) {
          return false;
      }
      return appInfo.should_show();
  }).map(function(app) {
      return app.get_id();
  });

  let shellApps = () => appInfos().map(function(appID) {
    return Shell.AppSystem.get_default().lookup_app(appID);
  });

  let appIcons = {};
  let iconSize = null;

  let getAppIcon = (app) => {
    const configuredIconSize = Convenience.getSettings().get_uint('icon-size');

    // if icon size changes, redo the whole cache
    if (configuredIconSize !== iconSize) {
      appIcons = {};
      iconSize = configuredIconSize;
      shellApps().forEach(function(app) {
        appIcons[app.get_id()] = app.create_icon_texture(iconSize);
      });
    }

    // if icon doesn't exist (e.g. new app installed) add it to the cache
    if (!appIcons.hasOwnProperty(app.get_id())) {
      appIcons[app.get_id()] = app.create_icon_texture(iconSize);
    }

    return appIcons[app.get_id()];
  }

  let seenIDs = {};
  let cleanIDs = () => seenIDs = {};
  let makeBox = function(app, appRef, description, index, onActivate) {
    const button = new St.Button({style_class: 'switcher-box'});
    const box = new St.BoxLayout();

    const label = new St.Label({
      style_class: 'switcher-label',
      y_align: Clutter.ActorAlign.CENTER
    });
    label.clutter_text.set_text(description);
    label.set_x_expand(true);
    box.insert_child_at_index(label, 0);

    let shortcutBox;
    if (Convenience.getSettings().get_uint('activate-by-key')) {
      const shortcut = new St.Label({
        style_class: 'switcher-shortcut',
        text: keyActivation.getKeyDesc(index + 1)
      });
      shortcutBox = new St.Bin({style_class: 'switcher-label'});
      shortcutBox.child = shortcut;
      box.insert_child_at_index(shortcutBox, 0);
    }

    // In case of multiple windows sharing the same id, we need to keep track
    // of ids which were already seen, in order to create a new icon for each
    // window beyond the first.
    // In another case, some windows may use a custom app id, forcing us to
    // create an icon.
    const iconBox = new St.Bin({style_class: 'switcher-icon'});
    const id = appRef.get_id();
    let appIcon = getAppIcon(appRef);
    if (seenIDs.hasOwnProperty(id) || appIcon === undefined) {
        iconBox.child = appRef.create_icon_texture(iconSize);
    } else {
        // To reuse the same icon, it's actor must not belong to any parent
        util.destroyParent(appIcon);
        iconBox.child = appIcon;

        seenIDs[id] = true; // Dummy value
    }
    box.insert_child_at_index(iconBox, 0);
    button.connect('clicked', () => onActivate(app));
    button.set_child(box)
    button.set_fill(true, true);
    button.set_track_hover(true);

    return { whole: button, iconBox: iconBox, shortcutBox: shortcutBox, label: label };
  };


  return {
    cleanIDs: cleanIDs,
    makeBox: makeBox,
    shellApps: shellApps
  };
}());
