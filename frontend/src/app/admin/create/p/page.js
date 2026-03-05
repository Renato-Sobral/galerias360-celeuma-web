"use client"

import { useState, useEffect } from 'react';
import Sidebar from '../../../components/sidebar';
import ProtectedRoute from '../../../components/protectedRoute';
import { getUserNameFromToken } from '../../../components/jwtDecode';

export default function CreatePoint() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [image, setImage] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [username, setUsername] = useState('');

    useEffect(() => {
        const fetchUsername = async () => {
            const username = await getUserNameFromToken();
            setUsername(username);
        };
        fetchUsername();
    })

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Simple validation to make sure all fields are filled
        if (!name || !description || !latitude || !longitude || !image) {
            setError('Please fill in all the fields and upload an image.');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('latitude', latitude);
        formData.append('longitude', longitude);
        formData.append('image', image);
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
                setImage(null);
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

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file); // Save the image file object
        }
    };

    return (
        <ProtectedRoute rolesRequired={"Admin"}>
            <div className="flex min-h-screen">
                <div className="w-80 bg-gray-800 text-white">
                    <Sidebar />
                </div>
                <div className="flex-1 flex justify-center items-center">
                    <form onSubmit={handleSubmit} className="space-y-6 w-80">
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
                            <label htmlFor="image" className="block text-sm font-medium text-gray-900">
                                Upload Image
                            </label>
                            <div className="mt-2">
                                <input
                                    id="image"
                                    name="image"
                                    type="file"
                                    accept="image/*"
                                    required
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                                    onChange={handleImageChange}
                                />
                            </div>
                            {image && <img src={URL.createObjectURL(image)} alt="Preview" className="mt-2 w-32 h-32 object-cover" />}
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
