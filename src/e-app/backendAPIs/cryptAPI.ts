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

import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { DriveController } from '../../common/classes/DriveController';
import type { IDrive } from '../../common/models/IDrive';
import { execCmd } from './utilsAPI';

async function changeCryptPassword(newPassword: string, oldPassword: string, confirmPassword: string): Promise<string> {
    let crypt_drives: IDrive[] = await DriveController.getDrives();
    crypt_drives = crypt_drives.filter((x: IDrive): boolean => x.crypt);
    const escapeSingleQuotes = (str: string): string => str.replace(/'/g, "'\\''");
    const escapedOld: string = escapeSingleQuotes(oldPassword);
    const escapedNew: string = escapeSingleQuotes(newPassword);
    const escapedConfirm: string = escapeSingleQuotes(confirmPassword);

    let oneliner: string = '';
    for (const drive of crypt_drives) {
        oneliner += `printf '%s\\n' '${escapedOld}' | /usr/sbin/cryptsetup open --type luks -q --test-passphrase ${drive.devPath} && `;
    }
    for (const drive of crypt_drives) {
        oneliner += `printf '%s\\n' '${escapedOld}' '${escapedNew}' '${escapedConfirm}' | /usr/sbin/cryptsetup -q luksChangeKey --force-password ${drive.devPath} && `;
    }
    oneliner = oneliner.slice(0, -4); // remove the tailing " && "
    return await execCmd(`pkexec /bin/sh -c "${oneliner}"`);
}

ipcMain.handle(
    'change-crypt-password',
    async (
        _event: IpcMainInvokeEvent,
        newPassword: string,
        oldPassword: string,
        confirmPassword: string,
    ): Promise<string> => {
        return changeCryptPassword(newPassword, oldPassword, confirmPassword);
    },
);

ipcMain.handle('drive-controller-get-drives', (_event: IpcMainInvokeEvent): Promise<IDrive[]> => {
    try {
        return DriveController.getDrives();
    } catch (err: unknown) {
        console.error(`cryptAPI: drive-controller-get-drives failed => ${err}`);
        throw err;
    }
});
