'use client'

import React, { useEffect, useMemo } from 'react'
import {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import {
  LATAM_COUNTRIES,
  PHONE_COUNTRIES,
  flagUrl,
  getCountry,
} from '@/lib/latam-location'

type SignupContactFieldsProps = {
  values: any
  touched: any
  errors: any
  handleBlur: any
  handleChange: any
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void
}

async function detectCountryByIp() {
  try {
    const response = await fetch('https://ipapi.co/json/')
    if (!response.ok) return null
    const data = await response.json()
    return typeof data?.country_code === 'string' ? data.country_code.toUpperCase() : null
  } catch {
    return null
  }
}

export function buildSignupContactDetails(values: any) {
  const phoneCountry = getCountry(values.whatsapp_country_code, PHONE_COUNTRIES)
  const locationCountry = getCountry(values.country_code, LATAM_COUNTRIES)
  const whatsappNumber = `${phoneCountry.dialCode}${String(values.whatsapp_phone || '').replace(/\D/g, '')}`

  return {
    ...(values.details || {}),
    whatsapp: {
      country_code: phoneCountry.code,
      dial_code: phoneCountry.dialCode,
      phone: values.whatsapp_phone,
      international_phone: whatsappNumber,
    },
    location: {
      country_code: locationCountry.code,
      country: locationCountry.name,
      region: values.region,
    },
  }
}

export default function SignupContactFields({
  values,
  touched,
  errors,
  handleBlur,
  handleChange,
  setFieldValue,
}: SignupContactFieldsProps) {
  const selectedPhoneCountry = getCountry(values.whatsapp_country_code, PHONE_COUNTRIES)
  const selectedCountry = getCountry(values.country_code, LATAM_COUNTRIES)

  const regions = useMemo(() => selectedCountry.regions, [selectedCountry])

  useEffect(() => {
    let cancelled = false

    detectCountryByIp().then((countryCode) => {
      if (cancelled || !countryCode) return

      const phoneCountry = getCountry(countryCode, PHONE_COUNTRIES)
      const latamCountry = LATAM_COUNTRIES.find((country) => country.code === countryCode)

      setFieldValue('whatsapp_country_code', phoneCountry.code, false)
      if (latamCountry) {
        setFieldValue('country_code', latamCountry.code, false)
        setFieldValue('region', latamCountry.regions[0] || '', false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [setFieldValue])

  useEffect(() => {
    if (!regions.includes(values.region)) {
      setFieldValue('region', regions[0] || '', false)
    }
  }, [regions, setFieldValue, values.region])

  return (
    <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
      <FormField name="whatsapp_phone">
        <FormLabelAndMessage
          label="WhatsApp"
          message={touched.whatsapp_phone ? errors.whatsapp_phone : undefined}
        />
        <div className="flex min-w-0 gap-2">
          <div className="relative h-10 w-[94px] shrink-0">
            <select
              name="whatsapp_country_code"
              value={values.whatsapp_country_code}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-label="Codigo de pais para WhatsApp"
              className="absolute inset-0 h-10 w-full cursor-pointer opacity-0"
            >
              {PHONE_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} {country.dialCode}
                </option>
              ))}
            </select>
            <div className="pointer-events-none flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-gray-700">
              <img
                src={flagUrl(selectedPhoneCountry.code)}
                alt={selectedPhoneCountry.name}
                className="h-[18px] w-6 rounded-sm object-cover"
              />
              <span>{selectedPhoneCountry.dialCode}</span>
            </div>
          </div>
          <Form.Control asChild>
            <Input
              name="whatsapp_phone"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.whatsapp_phone}
              type="tel"
              inputMode="tel"
              placeholder="Numero"
              className="min-w-0"
              required
            />
          </Form.Control>
        </div>
      </FormField>

      <div className="grid grid-cols-1 gap-3">
        <FormField name="country_code">
          <FormLabelAndMessage
            label="Pais"
            message={touched.country_code ? errors.country_code : undefined}
          />
          <div className="flex min-w-0 gap-2">
            <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white">
              <img
                src={flagUrl(selectedCountry.code)}
                alt={selectedCountry.name}
                className="h-[18px] w-6 rounded-sm object-cover"
              />
            </div>
            <select
              name="country_code"
              value={values.country_code}
              onChange={handleChange}
              onBlur={handleBlur}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              {LATAM_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </FormField>

        <FormField name="region">
          <FormLabelAndMessage
            label="Provincia / departamento / estado"
            message={touched.region ? errors.region : undefined}
          />
          <select
            name="region"
            value={values.region}
            onChange={handleChange}
            onBlur={handleBlur}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            required
          >
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </div>
  )
}
