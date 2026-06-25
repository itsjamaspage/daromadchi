'use client'
// v3
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowRight, Menu, X, Check,
  ChevronDown, BarChart2, Package, Bell,
  LayoutDashboard, ShoppingCart, Megaphone, Layers,
  BookOpen, MessageCircle, Plug2, UserCircle,
} from 'lucide-react'
import { useTheme, useLang } from './providers'
import type { Lang } from '@/lib/i18n'

import PillNav from './components/PillNav'
import BorderGlow from './components/BorderGlow'
import SectionHoverAnim from './components/SectionHoverAnim'
const LiquidEther = dynamic(() => import('./components/LiquidEther'), { ssr: false })

// Fluid animation colour sets
// ANIM_WHITE: pure white/silver shimmer — used on all blue-background sections so the
// fluid reads as white light rather than blending into the blue background.
const ANIM_WHITE   = ['#ffffff', '#ffffff', '#f8fafc', '#f0f0f0', '#e8e8e8'] as const
const ANIM_BLUE    = ['#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'] as const
// Dark mode: white/light gray at very low opacity — visible as gentle shimmer, no glow
const ANIM_BLUE_DK = ['#ffffff', '#f5f5f5', '#ebebeb', '#dcdcdc', '#cdcdcd'] as const
