/*!
 * Copyright (c) 2019-2026 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
 *
 * This file is part of TUXEDO Control Center.
 *
 * TUXEDO Control Center is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TUXEDO Control Center is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TUXEDO Control Center.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { ConfigHandler } from '../../common/classes/ConfigHandler';
import { TccPaths } from '../../common/classes/TccPaths';
import type { ITccProfile } from '../../common/models/TccProfile';
import type { ITccSettings } from '../../common/models/TccSettings';
import { cwd, environmentIsProduction, execFile, execFileSync } from './utilsAPI';

const config: ConfigHandler = new ConfigHandler(
    TccPaths.SETTINGS_FILE,
    TccPaths.PROFILES_FILE,
    TccPaths.WEBCAM_FILE,
    TccPaths.V4L2_NAMES_FILE,
    TccPaths.FANTABLES_FILE,
);

async function pkexecWriteCustomProfilesAsync(newProfileList: ITccProfile[]): Promise<boolean> {
    const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-'));
    const tmpProfilesPath: string = path.join(tmpDir, 'tmptccprofiles');
    config.writeProfiles(newProfileList, tmpProfilesPath);
    let tccdExec: string;
    if (environmentIsProduction) {
        tccdExec = TccPaths.TCCD_EXEC_FILE;
    } else {
        tccdExec = `${cwd}/dist/tuxedo-control-center/data/service/tccd`;
    }

    try {
        await execFile('pkexec', [tccdExec, '--new_profiles', tmpProfilesPath]);
        return true;
    } catch (err: unknown) {
        console.error(`configAPI: pkexecWriteCustomProfilesAsync failed => ${err}`);
        return false;
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_err: unknown) {}
    }
}

function pkexecWriteCustomProfiles(profiles: ITccProfile[]): boolean {
    const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-'));
    const tmpProfilesPath: string = path.join(tmpDir, 'tmptccprofiles');
    config.writeProfiles(profiles, tmpProfilesPath);
    let tccdExec: string;
    if (environmentIsProduction) {
        tccdExec = TccPaths.TCCD_EXEC_FILE;
    } else {
        tccdExec = `${cwd}/dist/tuxedo-control-center/data/service/tccd`;
    }
    try {
        execFileSync('pkexec', [tccdExec, '--new_profiles', tmpProfilesPath]);
        return true;
    } catch (err: unknown) {
        console.error(`configAPI: pkexecWriteCustomProfiles failed => ${err}`);
        return false;
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_err: unknown) {}
    }
}

async function pkexecWriteConfigAsync(settings: ITccSettings, profiles: ITccProfile[]): Promise<boolean> {
    const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-'));
    const tmpProfilesPath: string = path.join(tmpDir, 'tmptccprofiles');
    const tmpSettingsPath: string = path.join(tmpDir, 'tmptccsettings');
    config.writeProfiles(profiles, tmpProfilesPath);
    config.writeSettings(settings, tmpSettingsPath);
    let tccdExec: string;

    if (environmentIsProduction) {
        tccdExec = TccPaths.TCCD_EXEC_FILE;
    } else {
        tccdExec = `${cwd}/dist/tuxedo-control-center/data/service/tccd`;
    }

    try {
        const data: { data: string; error: unknown } = await execFile('pkexec', [
            tccdExec,
            '--new_profiles',
            tmpProfilesPath,
            '--new_settings',
            tmpSettingsPath,
        ]);
        return !data.error;
    } catch (err: unknown) {
        console.error('configAPI: pkexecWriteConfigAsync failed =>', err);
        return false;
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_err: unknown) {}
    }
}

ipcMain.on(
    'config-set-active-profile',
    async (_event: IpcMainEvent, profileId: string, stateId: string, settings: ITccSettings): Promise<void> => {
        // Copy existing current settings and set id of new profile
        const newSettings: ITccSettings = config.copyConfig<ITccSettings>(settings);

        newSettings.stateMap[stateId] = profileId;
        const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-'));
        const tmpSettingsPath: string = path.join(tmpDir, 'tmptccsettings');
        config.writeSettings(newSettings, tmpSettingsPath);
        let tccdExec: string;

        if (environmentIsProduction) {
            tccdExec = TccPaths.TCCD_EXEC_FILE;
        } else {
            tccdExec = `${cwd}/dist/tuxedo-control-center/data/service/tccd`;
        }
        try {
            await execFile('pkexec', [tccdExec, '--new_settings', tmpSettingsPath]);
        } catch (err: unknown) {
            console.error(`configAPI: config-set-active-profile failed => ${err}`);
        } finally {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (_err: unknown) {}
        }
    },
);

ipcMain.on('config-pkexec-write-custom-profiles', (event: IpcMainEvent, customProfiles: ITccProfile[]): void => {
    event.returnValue = pkexecWriteCustomProfiles(customProfiles);
});

ipcMain.handle(
    'config-pkexec-write-custom-profiles-async',
    (_event: IpcMainInvokeEvent, customProfiles: ITccProfile[]): Promise<boolean> => {
        return pkexecWriteCustomProfilesAsync(customProfiles);
    },
);

ipcMain.handle(
    'config-pkexec-write-config-async',
    (_event: IpcMainInvokeEvent, settings: ITccSettings, customProfiles: ITccProfile[]): Promise<boolean> => {
        return pkexecWriteConfigAsync(settings, customProfiles);
    },
);

ipcMain.on('config-get-default-fan-profiles', (event: IpcMainEvent): void => {
    event.returnValue = config.getDefaultFanProfiles();
});
