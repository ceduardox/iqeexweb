'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import UserAvatar from '@components/Objects/UserAvatar';
import { getAPIUrl, getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { ArrowRightCircle, Info } from 'lucide-react';
import { signOut } from '@components/Contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import iqexLogo from 'public/iqex-logo.png'
import React, { useEffect } from 'react'
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@components/ui/dropdown-menu"
import { Languages, Check, LogOut, Settings, User } from 'lucide-react';
import { AVAILABLE_LANGUAGES } from '@/lib/languages';
import { normalizeLanguageCode, setAppLanguage } from '@/lib/i18n';

function HomeClient() {
  const { t, i18n } = useTranslation();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { data: orgs } = useSWR(`${getAPIUrl()}orgs/user/page/1/limit/10`, (url) => swrFetcher(url, access_token))
  const currentLanguage = normalizeLanguageCode(
    i18n.resolvedLanguage || i18n.language
  )

  const changeLanguage = async (lng: string) => {
    await setAppLanguage(lng)
  }

  useEffect(() => {
  }, [session, orgs])
  return (
    <div className='flex flex-col'>
      <div className='flex mx-auto pt-12 items-center'>
        <Image
          quality={100}
          width={180}
          height={56}
          src={iqexLogo}
          alt="IQexponencial"
          className='h-auto w-auto max-h-14'
          priority
        />
      </div>

      <div className='flex space-x-4 mx-auto font-semibold text-2xl pt-12 items-center'>
        <span>{t('common.hello')},</span> 
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer transition-transform hover:scale-105">
              <UserAvatar border="border-2" rounded="rounded-full" width={40} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="center">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{session?.data?.user.first_name} {session?.data?.user.last_name}</p>
                <p className="text-xs text-gray-500">{session?.data?.user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center space-x-2">
                <Languages size={14} />
                <span>{t('common.language')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {AVAILABLE_LANGUAGES.map((language) => (
                    <DropdownMenuItem 
                      key={language.code}
                      onClick={() => void changeLanguage(language.code)} 
                      className="flex items-center justify-between"
                    >
                      <span>{t(language.translationKey)} ({language.nativeName})</span>
                      {currentLanguage === language.code && <Check size={14} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account/general" className="flex items-center space-x-2 w-full">
                <Settings size={16} />
                <span>{t('common.settings')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })}
              className="flex items-center space-x-2 text-red-600 focus:text-red-600"
            >
              <LogOut size={16} />
              <span>{t('user.sign_out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className='capitalize'>{session?.data?.user.first_name} {session?.data?.user.last_name}</span>
      </div>
      
      <div className='flex space-x-4 mx-auto font-semibold text-sm mt-12 items-center uppercase bg-slate-200 text-gray-600 px-3 py-2 rounded-md'>{t('common.your_organizations')}</div>
      {orgs && orgs.length == 0 && <div className='flex mx-auto my-5 space-x-3 bg-rose-200 rounded-lg px-3 py-2'>
        <Info />
        <span>{t('common.no_orgs_message')} </span>
      </div>}
      <div className='flex mx-auto pt-10 rounded-lg'>
        {orgs && orgs.map((org: any) => (
          <Link href={getUriWithOrg(org.slug, '/')} key={org.id} className='flex space-x-2 mx-auto w-fit justify-between items-center outline outline-1 outline-slate-200 px-3 py-2 rounded-lg'>
            <div>{org.name}</div>
            <ArrowRightCircle />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default HomeClient
