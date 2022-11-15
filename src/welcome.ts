import { Controller, Get, Inject, Body, Post } from '@midwayjs/decorator';
import {Context} from '@midwayjs/koa';
import {makeHttpRequest} from '@midwayjs/core';

/**
 * 欢迎界面
 */
@Controller('/')
export class WelcomeController {
    @Inject()
    ctx: Context;

    // webhook: 'https://oapi.dingtalk.com/robot/send?access_token=b8dde52ae19e2511bb1848c61ef63385c2760af8e590c97361d92c0def6c546b'

    @Get('/')
    public async welcome() {
        await this.ctx.render('welcome', {
            text: 'Girl-email',
        });


    }

    @Post('/hb/sendRobot')
    public async hanbing(@Body() body: {
        errMsg: string,
        url: string,
        webhook: string
        },
    ) {

        const msg: string = '### 鉴权通知\n' +
            '--- \n' +
            `- 链接： ${body.url} \n` +
            `- 报错内容： ${body.errMsg}\n`;
        const data = {
            msgtype: 'markdown',
            markdown: {
                title:'消息推送',
                text: msg
            },
            at: {
                atMobiles: [
                ],
                isAtAll: false
            }
        }

        const webhook = 'https://oapi.dingtalk.com/robot/send?access_token=948226c5211f2183b312e304687b20d08c3b4149d2e645669d0741ac1a1325b7';

        const result = await makeHttpRequest(body.webhook || webhook, {
            data,
            dataType: 'json', // 返回的数据格式
            method: 'POST',
            contentType:'json',
        });


        this.ctx.body = {
            code: 1,
            data: result.data,
            message: 'ok'
        }
    }

}
