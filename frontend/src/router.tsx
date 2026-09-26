import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './auth/guards';
import { AddressEditPage } from './pages/AddressEditPage';
import { AddressesPage } from './pages/AddressesPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MedicineDetailPage } from './pages/MedicineDetailPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { PaymentResultPage } from './pages/PaymentResultPage';
import { PetDetailPage } from './pages/PetDetailPage';
import { PetEditPage } from './pages/PetEditPage';
import { PetsPage } from './pages/PetsPage';
import { PharmacyDetailPage } from './pages/PharmacyDetailPage';
import { PharmaciesPage } from './pages/PharmaciesPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { Shell } from './App';

const authed = (element: ReactNode) => <RequireAuth>{element}</RequireAuth>;
const guestOnly = (element: ReactNode) => <RequireGuest>{element}</RequireGuest>;
const UiGalleryPage = import.meta.env.DEV ? lazy(() => import('./pages/UiGalleryPage')) : null;

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
        {UiGalleryPage && (
          <Route
            path="dev/ui"
            element={
              <Suspense fallback={<p>در حال بارگذاری…</p>}>
                <UiGalleryPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
