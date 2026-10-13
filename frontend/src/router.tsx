import { lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './auth/guards';

import { HomePage } from './pages/HomePage';

import { Shell } from './App';

const AddressEditPage = lazy(() => import('./pages/AddressEditPage').then((module) => ({ default: module.AddressEditPage })));
const AddressesPage = lazy(() => import('./pages/AddressesPage').then((module) => ({ default: module.AddressesPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((module) => ({ default: module.CartPage })));
const ClinicDetailPage = lazy(() => import('./pages/ClinicDetailPage').then((module) => ({ default: module.ClinicDetailPage })));
const ClinicsPage = lazy(() => import('./pages/ClinicsPage').then((module) => ({ default: module.ClinicsPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((module) => ({ default: module.FavoritesPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const MedicineDetailPage = lazy(() => import('./pages/MedicineDetailPage').then((module) => ({ default: module.MedicineDetailPage })));
const MedicinesPage = lazy(() => import('./pages/MedicinesPage').then((module) => ({ default: module.MedicinesPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage').then((module) => ({ default: module.PaymentResultPage })));
const PetDetailPage = lazy(() => import('./pages/PetDetailPage').then((module) => ({ default: module.PetDetailPage })));
const PetEditPage = lazy(() => import('./pages/PetEditPage').then((module) => ({ default: module.PetEditPage })));
const PetsPage = lazy(() => import('./pages/PetsPage').then((module) => ({ default: module.PetsPage })));
const PharmacyDetailPage = lazy(() => import('./pages/PharmacyDetailPage').then((module) => ({ default: module.PharmacyDetailPage })));
const PharmaciesPage = lazy(() => import('./pages/PharmaciesPage').then((module) => ({ default: module.PharmaciesPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage').then((module) => ({ default: module.RecommendationsPage })));
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage').then((module) => ({ default: module.VerifyOtpPage })));

const authed = (element: ReactNode) => <RequireAuth>{element}</RequireAuth>;
const guestOnly = (element: ReactNode) => <RequireGuest>{element}</RequireGuest>;

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="login" element={guestOnly(<LoginPage />)} />
        <Route path="verify" element={guestOnly(<VerifyOtpPage />)} />
        <Route path="profile" element={authed(<ProfilePage />)} />
        <Route path="addresses" element={authed(<AddressesPage />)} />
        <Route path="addresses/new" element={authed(<AddressEditPage />)} />
        <Route path="addresses/:id/edit" element={authed(<AddressEditPage />)} />
        <Route path="pets" element={authed(<PetsPage />)} />
        <Route path="pets/new" element={authed(<PetEditPage />)} />
        <Route path="pets/:id" element={authed(<PetDetailPage />)} />
        <Route path="pets/:id/edit" element={authed(<PetEditPage />)} />
        <Route path="recommendations" element={authed(<RecommendationsPage />)} />
        <Route path="favorites" element={authed(<FavoritesPage />)} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={authed(<CheckoutPage />)} />
        <Route path="payment/result" element={authed(<PaymentResultPage />)} />
        <Route path="orders" element={authed(<OrdersPage />)} />
        <Route path="orders/:id" element={authed(<OrderDetailPage />)} />
        <Route path="medicines" element={<MedicinesPage />} />
        <Route path="medicines/:id" element={<MedicineDetailPage />} />
        <Route path="pharmacies" element={<PharmaciesPage />} />
        <Route path="pharmacies/:id" element={<PharmacyDetailPage />} />
        <Route path="clinics" element={<ClinicsPage />} />
        <Route path="clinics/:id" element={<ClinicDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
