import {Inject, Provide, Config} from '@midwayjs/decorator';
import {BaseService, CoolCommException, RESCODE} from '@cool-midway/core';
import {LoginDTO} from '../../dto/login';
import * as svgCaptcha from 'svg-captcha';
import {v1 as uuid} from 'uuid';
import {BaseSysUserEntity} from '../../entity/sys/user';
import {Repository} from 'typeorm';
import {InjectEntityModel} from '@midwayjs/orm';
import * as md5 from 'md5';
import {BaseSysRoleService} from './role';
import * as _ from 'lodash';
import {BaseSysMenuService} from './menu';
import {BaseSysDepartmentService} from './department';
import * as jwt from 'jsonwebtoken';
import * as svgToDataURL from 'mini-svg-data-uri';
import {Context} from '@midwayjs/koa';
import {CacheManager} from '@midwayjs/cache';
import {BaseSysUserRoleEntity} from "../../entity/sys/user_role";

const nodemailer = require("nodemailer");


/**
 * 登录
 */
@Provide()
export class BaseSysLoginService extends BaseService {
    @Inject()
    cacheManager: CacheManager;

    @InjectEntityModel(BaseSysUserEntity)
    baseSysUserEntity: Repository<BaseSysUserEntity>;

    @InjectEntityModel(BaseSysUserRoleEntity)
    baseSysUserRoleEntity: Repository<BaseSysUserRoleEntity>;

    @Inject()
    baseSysRoleService: BaseSysRoleService;

    @Inject()
    baseSysMenuService: BaseSysMenuService;

    @Inject()
    baseSysDepartmentService: BaseSysDepartmentService;

    @Inject()
    ctx: Context;

    @Config('module.base')
    coolConfig;

    /**
     * 登录
     * @param login
     */
    async login(login: LoginDTO) {
        // const { username, captchaId, verifyCode, password, email} = login;
        const {password, email} = login;
        // 校验验证码
        // const checkV = await this.captchaCheck(captchaId, verifyCode);
        const checkV = false;
        if (!checkV) {
            const user = await this.baseSysUserEntity.findOne({email});
            // 校验用户
            if (user) {
                // 校验用户状态及密码
                if (user.status === 0 || user.password !== md5(password)) {
                    throw new CoolCommException('账户或密码不正确~');
                }
            } else {
                throw new CoolCommException('账户或密码不正确~');
            }
            // 校验角色
            const roleIds = await this.baseSysRoleService.getByUser(user.id);
            if (_.isEmpty(roleIds)) {
                // throw new CoolCommException('该用户未设置任何角色，无法登录~');
            }

            // 生成token
            const {expire, refreshExpire} = this.coolConfig.jwt.token;
            const result = {
                expire,
                email,
                token: await this.generateToken(user, roleIds, expire),
                refreshExpire,
                refreshToken: await this.generateToken(
                    user,
                    roleIds,
                    refreshExpire,
                    true
                ),
            };

            // 将用户相关信息保存到缓存
            const perms = await this.baseSysMenuService.getPerms(roleIds);
            const departments = await this.baseSysDepartmentService.getByRoleIds(
                roleIds,
                user.username === 'admin'
            );
            await this.cacheManager.set(`admin:department:${user.id}`, departments);
            await this.cacheManager.set(`admin:perms:${user.id}`, perms);
            await this.cacheManager.set(`admin:token:${user.id}`, result.token);
            await this.cacheManager.set(
                `admin:token:refresh:${user.id}`,
                result.token
            );

            return result;
        } else {
            throw new CoolCommException('验证码不正确');
        }
    }

    /**
     * 验证码
     * @param type 图片验证码类型 svg
     * @param width 宽
     * @param height 高
     */
    async captcha(type: string, width = 150, height = 50) {
        const svg = svgCaptcha.create({
            ignoreChars: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM',
            width,
            height,
        });
        const result = {
            captchaId: uuid(),
            data: svg.data.replace(/"/g, "'"),
        };
        // 文字变白
        const rpList = [
            '#111',
            '#222',
            '#333',
            '#444',
            '#555',
            '#666',
            '#777',
            '#888',
            '#999',
        ];
        rpList.forEach(rp => {
            result.data = result.data['replaceAll'](rp, '#fff');
        });
        if (type === 'base64') {
            result.data = svgToDataURL(result.data);
        }
        // 半小时过期
        await this.cacheManager.set(
            `verify:img:${result.captchaId}`,
            svg.text.toLowerCase(),
            {ttl: 1800}
        );
        return result;
    }

    /**
     * 退出登录
     */
    async logout() {
        const {userId} = this.ctx.admin;
        await this.cacheManager.del(`admin:department:${userId}`);
        await this.cacheManager.del(`admin:perms:${userId}`);
        await this.cacheManager.del(`admin:token:${userId}`);
        await this.cacheManager.del(`admin:token:refresh:${userId}`);
    }

    /**
     * 检验图片验证码
     * @param captchaId 验证码ID
     * @param value 验证码
     */
    async captchaCheck(captchaId, value) {
        const rv = await this.cacheManager.get(`verify:img:${captchaId}`);
        if (!rv || !value || value.toLowerCase() !== rv) {
            return false;
        } else {
            this.cacheManager.del(`verify:img:${captchaId}`);
            return true;
        }
    }

    /**
     * 生成token
     * @param user 用户对象
     * @param roleIds 角色集合
     * @param expire 过期
     * @param isRefresh 是否是刷新
     */
    async generateToken(user, roleIds, expire, isRefresh?) {
        await this.cacheManager.set(
            `admin:passwordVersion:${user.id}`,
            user.passwordV
        );
        const tokenInfo = {
            isRefresh: false,
            roleIds,
            username: user.username,
            userId: user.id,
            passwordVersion: user.passwordV,
        };
        if (isRefresh) {
            tokenInfo.isRefresh = true;
        }
        return jwt.sign(tokenInfo, this.coolConfig.jwt.secret, {
            expiresIn: expire,
        });
    }

    /**
     * 刷新token
     * @param token
     */
    async refreshToken(token: string) {
        try {
            const decoded = jwt.verify(token, this.coolConfig.jwt.secret);
            if (decoded && decoded['isRefresh']) {
                delete decoded['exp'];
                delete decoded['iat'];

                const {expire, refreshExpire} = this.coolConfig.jwt.token;
                decoded['isRefresh'] = false;
                const result = {
                    expire,
                    token: jwt.sign(decoded, this.coolConfig.jwt.secret, {
                        expiresIn: expire,
                    }),
                    refreshExpire,
                    refreshToken: '',
                };
                decoded['isRefresh'] = true;
                result.refreshToken = jwt.sign(decoded, this.coolConfig.jwt.secret, {
                    expiresIn: refreshExpire,
                });
                await this.cacheManager.set(
                    `admin:passwordVersion:${decoded['userId']}`,
                    decoded['passwordVersion']
                );
                await this.cacheManager.set(
                    `admin:token:${decoded['userId']}`,
                    result.token
                );
                return result;
            }
        } catch (err) {
            console.log(err);
            this.ctx.status = 401;
            this.ctx.body = {
                code: RESCODE.COMMFAIL,
                message: '登录失效~',
            };
            return;
        }
    }


    /**
     * 发邮件
     */
    async sendEmail(email: string) {
        // 判断用户是否存在
        const user = await this.baseSysUserEntity.findOne({email});
        if (user) {
            throw new CoolCommException('该用户已注册');
        }
        // 记录发送次数的KEY
        const cacheKeyTime = `login:email:time:${email}`
        // 缓存验证码的KEY
        const cacheKeyCode = `login:email:code:${email}`
        // 获取次数
        const timer = await this.cacheManager.get(cacheKeyTime);
        // 如果大于两次的话
        if (timer && Number(timer) >= 2) {
            throw new CoolCommException('发送过于频繁, 请稍后重试~');
        }
        // 邮件发送标题
        let EmailFrom = '"girl email 官方" <xiaobo21@163.com>';
        //发送者邮箱厂家
        let EmianService = "163";
        //发送者邮箱账户SMTP授权码
        let EamilAuth = {
            user: "xiaobo21@163.com",
            pass: "EXULUTFIDHUZVTUV"
        };
        //邮件主题
        let EmailSubject = `girl email 注册验证码`;
        let transporter = nodemailer.createTransport({
            service: EmianService,
            port: 465,
            secureConnection: true,
            auth: EamilAuth
        });
        const svg = svgCaptcha.create({
            charPreset: '1234567890',
        });
        const code = svg.text
        let mailOptions = {
            from: EmailFrom,
            to: email,
            subject: EmailSubject,
            html: `<div>你的验证码是: ${code}</div>,  有效期3分钟!`
        };

        // 发送邮件
        const result = await transporter.sendMail(mailOptions, (error, info = {}) => {
        });
        // 存发送次数
        await this.cacheManager.set(cacheKeyTime, timer ? Number(timer) + 1 : 1, {
            ttl: 300
        });
        // 存code， 五分钟过期
        await this.cacheManager.set(cacheKeyCode, code, {
            ttl: 300
        });
        return result;
    }

    /**
     * 注册
     * @param body
     */
    async register(body: any) {

        const {email, code, password} = body;

        const cacheKeyCode = `login:email:code:${email}`
        const cacheCode = await this.cacheManager.get(cacheKeyCode);

        if (!cacheCode) {
            throw new CoolCommException('验证码已过期~');
        }

        if (cacheCode != code) {
            throw new CoolCommException('验证码错误~');
        }

        const user = await this.baseSysUserEntity.findOne({email});
        if (user) {
            throw new CoolCommException('该用户已注册~');
        }


        const param = {
            password,
            email,
            username: email
        }

        param.password = md5(param.password);
        // 保存用户信息
        const newUser = await this.baseSysUserEntity.save(param);

        // 保存角色关系
        await this.baseSysUserRoleEntity.save({userId: newUser.id, roleId: 11});

    }
}
