'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useFormik } from 'formik'
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Mail, Shield, X, Clock, LogIn } from 'lucide-react'
import { checkSSOEnabled, redirectToSSOLogin } from '@services/auth/sso'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@components/Contexts/AuthContext'
import { getLEARNHOUSE_TOP_DOMAIN_VAL, getDeploymentMode } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'
import { resendVerificationEmail } from '@services/auth/auth'
import AuthLayout from '@components/Auth/AuthLayout'

interface LoginClientProps {
  org: any
}

const LoginClient = (props: LoginClientProps) => {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const router = useRouter();
  const session = useLHSession() as any;

  // Error state with type information
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationResent, setVerificationResent] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const handleGoogleSignIn = () => {
    // Store org context in cookies before OAuth redirect
    if (props.org?.slug) {
      const topDomain = getLEARNHOUSE_TOP_DOMAIN_VAL();
      const isSecure = window.location.protocol === 'https:';
      const secureAttr = isSecure ? '; secure' : '';
      const baseAttributes = `; path=/; SameSite=Lax${secureAttr}`;
      const domainAttr = topDomain === 'localhost' ? '' : `; domain=.${topDomain}`;
      document.cookie = `learnhouse_oauth_orgslug=${props.org.slug}${baseAttributes}${domainAttr}`;
      document.cookie = `learnhouse_oauth_org_id=${props.org.id}${baseAttributes}${domainAttr}`;
    }
    // Use absolute URL with current origin for custom domain support
    signIn('google', { callbackUrl: `${window.location.origin}/redirect_from_auth` });
  };

  // Check if SSO is enabled for this organization (requires enterprise plan)
  useEffect(() => {
    const checkSSO = async () => {
      // SSO is only available for enterprise plan (requires EE or SaaS/enterprise)
      const orgConfig = props.org?.config?.config
      const plan = orgConfig?.plan ?? orgConfig?.cloud?.plan
      const mode = getDeploymentMode()
      if (mode === 'oss' || (mode === 'saas' && plan !== 'enterprise')) {
        setSsoEnabled(false)
        return
      }

      if (props.org?.slug) {
        try {
          const result = await checkSSOEnabled(props.org.slug)
          setSsoEnabled(result.sso_enabled)
        } catch (error) {
          // SSO not available, silently ignore
          console.debug('SSO check failed:', error)
        }
      }
    }
    checkSSO()
  }, [props.org?.slug, props.org?.config?.config?.plan, props.org?.config?.config?.cloud?.plan]) // eslint-disable-line

  const handleSSOLogin = async () => {
    setSsoLoading(true)
    try {
      await redirectToSSOLogin(props.org.slug)
    } catch (error: any) {
      setError(error.message || t('auth.sso_error'))
      setSsoLoading(false)
    }
  }

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
      errors.email = t('validation.required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = t('validation.invalid_email')
    }

    if (!values.password) {
      errors.password = t('validation.required')
    } else if (values.password.length < 8) {
      errors.password = t('validation.password_min_length')
    }

    return errors
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail || !props.org?.id) return

    setIsResendingVerification(true)
    try {
      const res = await resendVerificationEmail(unverifiedEmail, props.org.id)
      if (res.success) {
        setVerificationResent(true)
      } else {
        setError(res.error || t('auth.resend_verification_failed'))
      }
    } catch (err) {
      setError(t('auth.resend_verification_failed'))
    } finally {
      setIsResendingVerification(false)
    }
  }

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values, {validateForm, setErrors, setSubmitting}) => {
      setIsSubmitting(true)
      setError('')
      setErrorType(null)
      setUnverifiedEmail(null)
      setVerificationResent(false)
      setShowErrorModal(false)
      setRetryAfter(null)

      const errors = await validateForm(values);
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        setSubmitting(false);
        setIsSubmitting(false);
        return;
      }

      // Use absolute URL with current origin for custom domain support
      const callbackUrl = `${window.location.origin}/redirect_from_auth`;

      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl
      });

      if (res && res.error) {
        // Try to parse the error message for error codes
        try {
          // The error from next-auth might contain our structured error
          const errorData = JSON.parse(res.error);
          if (errorData.code) {
            setErrorType(errorData.code);
            setError(errorData.message || t('auth.wrong_email_password'));
            if (errorData.code === 'EMAIL_NOT_VERIFIED') {
              setUnverifiedEmail(errorData.email || values.email);
            }
            if (errorData.retry_after) {
              setRetryAfter(errorData.retry_after);
            }
          } else {
            setError(t('auth.wrong_email_password'));
          }
        } catch {
          // If parsing fails, check for specific error strings
          if (res.error.includes('EMAIL_NOT_VERIFIED')) {
            setErrorType('EMAIL_NOT_VERIFIED');
            setError(t('auth.email_not_verified_message'));
            setUnverifiedEmail(values.email);
          } else if (res.error.includes('ACCOUNT_LOCKED')) {
            setErrorType('ACCOUNT_LOCKED');
            setError(t('auth.account_locked_message'));
          } else if (res.error.includes('RATE_LIMITED')) {
            setErrorType('RATE_LIMITED');
            setError(t('auth.rate_limited_message'));
          } else {
            setError(t('auth.wrong_email_password'));
          }
        }
        setShowErrorModal(true);
        setIsSubmitting(false);
      } else {
        // First signIn already authenticated and set cookies — just redirect
        window.location.href = callbackUrl;
      }
    },
  })

  return (
    <AuthLayout org={props.org} welcomeText={t('auth.login_to')}>
        {/* Error Top Bar */}
        {showErrorModal && (
          <div className={`
            w-full px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200
            ${errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent ? 'bg-amber-500 text-white' : ''}
            ${verificationResent ? 'bg-green-500 text-white' : ''}
            ${errorType === 'ACCOUNT_LOCKED' ? 'bg-red-500 text-white' : ''}
            ${errorType === 'RATE_LIMITED' ? 'bg-orange-500 text-white' : ''}
            ${error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' ? 'bg-red-500 text-white' : ''}
          `}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && <Mail size={18} className="shrink-0" />}
              {verificationResent && <Mail size={18} className="shrink-0" />}
              {errorType === 'ACCOUNT_LOCKED' && <Lock size={18} className="shrink-0" />}
              {errorType === 'RATE_LIMITED' && <Clock size={18} className="shrink-0" />}
              {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && <AlertTriangle size={18} className="shrink-0" />}

              <div className="flex-1 min-w-0">
                {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{t('auth.email_not_verified_message')}</span>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification}
                      className="text-sm underline hover:no-underline disabled:opacity-50"
                    >
                      {isResendingVerification ? t('common.loading') : t('auth.resend_verification_email')}
                    </button>
                  </div>
                )}
                {verificationResent && (
                  <span className="text-sm font-medium">{t('auth.verification_email_resent')} - {t('auth.check_inbox_message')}</span>
                )}
                {errorType === 'ACCOUNT_LOCKED' && (
                  <span className="text-sm font-medium">
                    {t('auth.account_locked')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {errorType === 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">
                    {t('auth.rate_limited')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">{error}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setShowErrorModal(false)
                if (verificationResent) setVerificationResent(false)
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-row">
        <div className="m-auto w-full max-w-sm px-6 py-10 sm:py-8">
          {/* Header */}
          <div className="mb-5">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-200">
              <LogIn size={22} />
            </div>
            <h1 className="text-2xl font-bold text-gray-950">{t('auth.welcome_back')}</h1>
            <p className="mt-1 text-sm leading-6 text-gray-500">{t('auth.enter_credentials')}</p>
          </div>

          {/* Login Form Card */}
          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
            <div className="h-1 bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-500" />
            <div className="space-y-5 bg-gradient-to-br from-white via-white to-indigo-50/30 p-5">
            <FormLayout onSubmit={formik.handleSubmit}>
              <FormField name="email">
                <FormLabelAndMessage
                  label={t('auth.email')}
                  message={formik.touched.email ? formik.errors.email : undefined}
                />
                <Form.Control asChild>
                  <Input
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.email}
                    type="email"
                    placeholder="tu@email.com"
                  />
                </Form.Control>
              </FormField>

              <FormField name="password">
                <FormLabelAndMessage
                  label={t('auth.password')}
                  message={formik.touched.password ? formik.errors.password : undefined}
                />
                <Form.Control asChild>
                  <Input
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Tu contrasena"
                  />
                </Form.Control>
              </FormField>

              <div className="flex justify-end">
                <Link
                  href="/forgot"
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {t('auth.forgot_password')}
                </Link>
              </div>

              <div className="pt-2">
                <Form.Submit asChild>
                  <button className="w-full rounded-lg bg-indigo-600 py-2.5 text-center font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md">
                    {isSubmitting ? t('common.loading') : t('auth.login')}
                  </button>
                </Form.Submit>
              </div>
            </FormLayout>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-indigo-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-gray-400">{t('common.or')}</span>
              </div>
            </div>

            {/* Social & SSO Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-100 bg-white py-2.5 font-medium text-gray-700 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="" className="w-4 h-4" />
                <span>{t('auth.sign_in_with_google')}</span>
              </button>

              {ssoEnabled && (
                <button
                  onClick={handleSSOLogin}
                  disabled={ssoLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black disabled:opacity-50"
                >
                  <Shield size={16} />
                  <span>{ssoLoading ? t('common.loading') : t('auth.sign_in_with_sso')}</span>
                </button>
              )}
            </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 mt-6">
            {t('auth.no_account')}{' '}
            <Link href="/signup" className="font-semibold text-gray-900 hover:underline">
              {t('auth.sign_up')}
            </Link>
          </p>
        </div>
        </div>
    </AuthLayout>
  )
}

export default LoginClient
