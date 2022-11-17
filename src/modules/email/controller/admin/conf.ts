import { EmailConfigEntity } from '../../entity/config';
import { BaseController, CoolController } from '@cool-midway/core';

/**
 * 邮件模板设置
 */
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: EmailConfigEntity,
    insertParam: (ctx => {
        return {
            // 获得当前登录的后台用户ID，需要请求头传Authorization参数
            user_id: ctx.admin.userId
        }
    }),
    pageQueryOp: {
        // 增加其他条件
        where: async (ctx) => {
            return [
                // 价格大于90
                ['user_id = :price', { price: ctx.admin.userId }],
                // ['a.price > :price', { price: 90.00 }, '条件']
            ]
        },
    }
})
export class EmailConfController extends BaseController {


}
