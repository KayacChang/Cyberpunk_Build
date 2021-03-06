import {log, table, divide, waitByFrameTime, err} from '@kayac/utils';

import {FreeGame, NormalGame} from './flow';

import app from '../../../../system/application';

const BET_TO_BIGWIN = 10;

function isBigWin(scores) {
    return divide(scores, app.user.currentBet) > BET_TO_BIGWIN;
}

export function logic(args) {
    const {
        app,
        slot,
        grid,
        payLine,
        levels,
        multiple,
        counter,
        showFreeGame,
        closeFreeGame,
        showRandomWild,
        showBigWin,
    } = args;

    app.on('GameResult', onGameResult);

    async function onGameResult(result) {
        log('onGameResult =============');
        table(result);

        const {cash, normalGame, freeGame} = result;

        if (normalGame.hasLink) {
            log('onNormalGame =============');
            table(normalGame);
        }

        const scores = await NormalGame({
            result: normalGame,
            reels: slot.reels,

            grid,
            payLine,
            showRandomWild,
        });

        if (isBigWin(scores)) {
            await waitByFrameTime(360);

            await showBigWin(scores);
        }

        await clear(scores);

        if (freeGame) {
            app.user.lastWin = 0;

            await showFreeGame();

            counter.show();

            let totalScores = 0;
            let currentLevel = 0;

            for (const result of freeGame) {
                const {scores, level} = await FreeGame({
                    result: result,
                    reels: slot.reels,

                    grid,
                    payLine,
                });

                if (counter.value > 0) counter.value -= 1;

                totalScores += scores;

                const diff = level - currentLevel;
                if (diff > 0) {
                    //
                    for (let i = diff; i > 0; i -= 1) {
                        await levels[currentLevel].show();

                        currentLevel += 1;
                    }

                    const match = {
                        '8': 'x2',
                        '10': 'x3',
                        '12': 'x5',
                        '14': 'x8',
                    }[currentLevel];

                    if (match) multiple.show(match);
                }
            }

            if (isBigWin(totalScores)) {
                await waitByFrameTime(360);

                await showBigWin(totalScores);
            }

            await clear(totalScores);

            counter.hide();

            await closeFreeGame();
        }

        if (app.user.cash !== cash) {
            err(`
            Inconsistent data between Client App and Server:
            Cash
                Client: ${app.user.cash},
                Server: ${cash},
            `);
        }

        log('Round Complete...');

        app.emit('Idle');
    }

    async function clear(scores) {
        app.user.lastWin = scores;
        app.user.cash += scores;

        if (scores) await waitByFrameTime(720);
    }
}
