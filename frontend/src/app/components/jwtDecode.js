import { jwtDecode } from 'jwt-decode';

const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);

export const getUserRoleFromToken = () => {
  const token = getToken();

  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    return decoded.role;
  } catch (error) {
    console.error('Erro ao decodificar o token:', error);
    return null;
  }
};

export const getUserRoleIdFromToken = () => {
  const token = getToken();

  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    const roleId = Number(decoded.id_role);
    return Number.isInteger(roleId) ? roleId : null;
  } catch (error) {
    console.error('Erro ao decodificar o token:', error);
    return null;
  }
};

export const getUserIdFromToken = () => {
  const token = getToken();
  if (token) {
    const decoded = jwtDecode(token);
    return decoded.user;
  }
  return null;
};

export const getUserNameFromToken = () => {
  const token = getToken();
  if (token) {
    const decoded = jwtDecode(token);
    return decoded.name;
  }
  return null;
};

export const getEmailFromToken = () => {
  const token = getToken();
  if (token) {
    const decoded = jwtDecode(token);
    return decoded.email;
  }
  return null;
};

export const getUserDataFromToken = () => {
  const token = getToken();

  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    return {
      role: decoded.role,
      userId: decoded.user,
      name: decoded.name,
      email: decoded.email,
    };
  } catch (error) {
    console.error('Erro ao decodificar o token:', error);
    return null;
  }
};
