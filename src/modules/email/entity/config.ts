import { EntityModel } from '@midwayjs/orm';
import { BaseEntity } from '@cool-midway/core';
import { Column } from 'typeorm';

/**
 * 邮件配置
 */
@EntityModel('email_config')
export class EmailConfigEntity extends BaseEntity {
    @Column({comment: '邮件标题'})
    email_subject: string;

    @Column({comment: '发送人'})
    startDay: string;

    @Column({comment: '发送人'})
    from_user: string;

    @Column({comment: '发送邮箱'})
    from_email: string;

    @Column({comment: '收件人/称呼'})
    to_user: string;

    @Column({comment: '收件人邮箱'})
    to_email: string;

    @Column({comment: '城市'})
    city: string;

    @Column({comment: '邮件模板',  type: 'tinyint', default: 0})
    email_template: number;

    @Column({comment: '纪念日',  type: 'date'})
    startDay: string;

    @Column({ comment: '用户id', type: 'tinyint', default: null })
    user_id: number;
}
