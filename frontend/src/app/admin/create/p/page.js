"use client"

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../../components/protectedRoute';
import { getUserNameFromToken } from '../../../components/jwtDecode';
import MultiCategoryPicker from '../../../components/MultiCategoryPicker';
import MediaSourceField from '../../../components/MediaSourceField';
import { resolveMediaSelection } from '../../../lib/media-library';

export default function CreatePoint() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [idCategorias, setIdCategorias] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [imageSelection, setImageSelection] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [username, setUsername] = useState('');

    useEffect(() => {
        const fetchUsername = async () => {
            const username = await getUserNameFromToken();
            setUsername(username);
        };
        const fetchCategorias = async () => {
            try {
                const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/list`;
                const response = await fetch(url);
                const data = await response.json();
                setCategorias(data.categorias || []);
            } catch (err) {
                console.error('Erro ao carregar categorias:', err);
            }
        };

        fetchUsername();
        fetchCategorias();
    }, [])

    const handleCreateCategoria = async (categoriaName) => {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/create`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
            },
            body: JSON.stringify({ name: categoriaName }),
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || payload.message || 'Não foi possível criar a categoria.');
        }

        if (payload.categoria) {
            setCategorias((prev) => {
                const exists = prev.some((categoria) => String(categoria.id_categoria) === String(payload.categoria.id_categoria));
                if (exists) return prev;
                return [...prev, payload.categoria].sort((left, right) => left.name.localeCompare(right.name));
            });
        }

        return payload.categoria;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Simple validation to make sure all fields are filled
        if (!name || !description || !latitude || !longitude || idCategorias.length === 0 || !imageSelection) {
            setError('Please fill in all the fields and select an image.');
            return;
        }

        const resolvedImage = await resolveMediaSelection(imageSelection, 'pontos');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('latitude', latitude);
        formData.append('longitude', longitude);
        formData.append('id_categorias', JSON.stringify(idCategorias));
        formData.append('imagePath', resolvedImage?.path || '');
        formData.append('username', username);

        console.log(formData)

        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/create`;
            // Send the form data to the backend API
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess('Point created successfully!');
                setError('');
                // Clear form fields
                setName('');
                setDescription('');
                setLatitude('');
                setLongitude('');
                setIdCategorias([]);
                setImageSelection(null);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'An error occurred');
                setSuccess('');
            }
        } catch (err) {
            setError('An error occurred while submitting the form.');
            setSuccess('');
        }
    };

    return (
        <ProtectedRoute rolesRequired={"Admin"}>
            <div className="min-h-screen bg-background text-foreground">
                <div className="mx-auto flex min-h-screen w-full max-w-3xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
                    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                                Name
                            </label>
                            <div className="mt-2">
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-900">
                                Description
                            </label>
                            <div className="mt-2">
                                <textarea
                                    id="description"
                                    name="description"
                                    required
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="latitude" className="block text-sm font-medium text-gray-900">
                                Latitude
                            </label>
                            <div className="mt-2">
                                <input
                                    id="latitude"
                                    name="latitude"
                                    type="number"
                                    required
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="longitude" className="block text-sm font-medium text-gray-900">
                                Longitude
                            </label>
                            <div className="mt-2">
                                <input
                                    id="longitude"
                                    name="longitude"
                                    type="number"
                                    required
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="id_categorias" className="block text-sm font-medium text-gray-900">
                                Categorias
                            </label>
                            <div className="mt-2">
                                <MultiCategoryPicker
                                    categorias={categorias}
                                    selectedIds={idCategorias}
                                    onChange={setIdCategorias}
                                    allowCreate
                                    onCreateCategory={handleCreateCategoria}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="image" className="block text-sm font-medium text-gray-900">
                                Upload Image
                            </label>
                            <div className="mt-2">
                                <MediaSourceField
                                    label="Imagem"
                                    accept="image/*"
                                    selection={imageSelection}
                                    onChange={setImageSelection}
                                    destinationPath="pontos"
                                    required
                                />
                            </div>
                        </div>

                        {error && <div className="text-red-600 text-sm">{error}</div>}
                        {success && <div className="text-green-600 text-sm">{success}</div>}

                        <div>
                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            >
                                Create Point
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ProtectedRoute>
    );
}
