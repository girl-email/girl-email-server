import { Rule, RuleType } from '@midwayjs/validate';
/**
 * 登录参数校验
 */
export class LoginDTO {
  // 用户名
  @Rule(RuleType.string().email().required())
  email: string;

  // 密码
  @Rule(RuleType.string().required())
  password: string;

}


/**
 * 发送邮件参数校验
 */
 export class SendMailDTO {
  @Rule(RuleType.string().email().required())
  email: string;

}

/**
 * 注册参数校验
 */
export class RegisterDTO {
  @Rule(RuleType.string().email().required())
  email: string;

  @Rule(RuleType.string().required())
  code: string;

  @Rule(RuleType.string().required())
  password: string;
}


